import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "TrustSignal <support@thesignal.directory>";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://trust.thesignal.directory";

export function isEmailConfigured(): boolean {
  return !!resend;
}

export async function sendContractInvite(params: {
  to: string;
  contractTitle: string;
  inviterName: string;
  inviterRole: "client" | "agency";
  inviteUrl: string;
  totalValue: number;
}): Promise<boolean> {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not configured — skipping invite email");
    return false;
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: `You've been invited to a contract: ${params.contractTitle}`,
      html: buildInviteHtml(params),
    });
    return true;
  } catch (error) {
    console.error("[email] Failed to send invite:", error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Notification emails
// ---------------------------------------------------------------------------

export type NotificationType =
  | "invite_accepted"
  | "escrow_deposited"
  | "deliverable_submitted"
  | "milestone_approved"
  | "milestone_rejected"
  | "dispute_started"
  | "dispute_verdict_ready"
  | "dispute_resolved"
  | "dispute_escalated"
  | "dispute_fee_paid"
  | "dispute_deadline_default"
  | "contract_completed"
  | "contract_refunded"
  | "investment_received"
  | "evidence_submitted";

interface NotificationParams {
  to: string;
  type: NotificationType;
  contractTitle: string;
  contractId: string;
  milestoneName?: string;
  amount?: number;
  reason?: string;
  actorName?: string;
  score?: number;
  winner?: string;
  tokenAmount?: number;
  deadline?: Date;
  investorName?: string;
}

const NOTIFICATION_CONFIG: Record<
  NotificationType,
  { subject: (p: NotificationParams) => string; body: (p: NotificationParams) => string }
> = {
  invite_accepted: {
    subject: (p) => `Contract accepted: ${p.contractTitle}`,
    body: (p) =>
      `<p><strong>${p.actorName || "The counterparty"}</strong> has accepted your contract invitation for <strong>${p.contractTitle}</strong>.</p>
       <p>The contract is now waiting for the client to deposit escrow funds to activate.</p>
       <p style="margin-top:12px;padding:12px;background:#e8f5e9;border-radius:6px;">Next step: The client needs to deposit escrow to activate the contract.</p>`,
  },
  escrow_deposited: {
    subject: (p) => `Escrow funded — contract active: ${p.contractTitle}`,
    body: (p) =>
      `<p>The client has deposited${p.amount ? ` <strong>$${p.amount.toLocaleString()}</strong>` : ""} into escrow for <strong>${p.contractTitle}</strong>.</p>
       <p>The contract is now <strong>active</strong>.</p>
       <p style="margin-top:12px;padding:12px;background:#e8f5e9;border-radius:6px;">You can now start delivering milestones. Submit your work when ready.</p>`,
  },
  deliverable_submitted: {
    subject: (p) => `Review needed: ${p.milestoneName || "Deliverable"} — ${p.contractTitle}`,
    body: (p) =>
      `<p>The agency has submitted a deliverable for milestone <strong>${p.milestoneName || "a milestone"}</strong> on contract <strong>${p.contractTitle}</strong>.</p>
       <p style="margin-top:12px;padding:12px;background:#fff3e0;border-radius:6px;">Action required: Please review the submission and approve or reject it.</p>`,
  },
  milestone_approved: {
    subject: (p) => `Milestone approved: ${p.milestoneName || p.contractTitle}`,
    body: (p) =>
      `<p>Your milestone <strong>${p.milestoneName || "a milestone"}</strong> on <strong>${p.contractTitle}</strong> has been approved by the client.</p>
       <p>The escrowed funds for this milestone have been released to you.</p>
       <p style="margin-top:12px;padding:12px;background:#e8f5e9;border-radius:6px;">Funds released. Check your wallet balance.</p>`,
  },
  milestone_rejected: {
    subject: (p) => `Milestone rejected: ${p.milestoneName || p.contractTitle}`,
    body: (p) =>
      `<p>Your milestone <strong>${p.milestoneName || "a milestone"}</strong> on <strong>${p.contractTitle}</strong> has been rejected by the client.</p>
       ${p.reason ? `<p><strong>Reason:</strong> ${p.reason}</p>` : ""}
       <p style="margin-top:12px;padding:12px;background:#fff3e0;border-radius:6px;">You can revise and re-submit your deliverable, or open a dispute if you disagree.</p>`,
  },
  dispute_started: {
    subject: (p) => `Dispute opened: ${p.milestoneName || p.contractTitle}`,
    body: (p) =>
      `<p>A dispute has been opened on milestone <strong>${p.milestoneName || "a milestone"}</strong> of contract <strong>${p.contractTitle}</strong>.</p>
       <p>An AI agent will analyze the deliverables and contract terms, then issue a verdict.</p>
       <p style="margin-top:12px;padding:12px;background:#fce4ec;border-radius:6px;">You will be notified once the AI verdict is ready. No action needed right now.</p>`,
  },
  dispute_verdict_ready: {
    subject: (p) => `AI verdict ready: ${p.contractTitle}`,
    body: (p) =>
      `<p>The AI agent has analyzed the dispute on <strong>${p.contractTitle}</strong> and issued a verdict.</p>
       ${p.score !== undefined ? `<p>AI confidence score: <strong>${p.score}/100</strong></p>` : ""}
       <p style="margin-top:12px;padding:12px;background:#fff3e0;border-radius:6px;">Action required: Review the verdict and choose to <strong>accept</strong> or <strong>reject</strong> it. If both parties accept, the AI ruling is enforced. If either rejects, the dispute escalates to Kleros Court.</p>`,
  },
  dispute_resolved: {
    subject: (p) => `Dispute resolved: ${p.contractTitle}`,
    body: (p) =>
      `<p>The dispute on contract <strong>${p.contractTitle}</strong> has been resolved.</p>
       ${p.winner ? `<p>Outcome: <strong>${p.winner}</strong></p>` : ""}
       ${p.milestoneName ? `<p>Milestone: <strong>${p.milestoneName}</strong></p>` : ""}
       <p style="margin-top:12px;padding:12px;background:#e8f5e9;border-radius:6px;">The contract status has been updated accordingly. View the contract for details.</p>`,
  },
  dispute_escalated: {
    subject: (p) => `Dispute escalated to Kleros Court: ${p.contractTitle}`,
    body: (p) =>
      `<p>The AI verdict on <strong>${p.contractTitle}</strong> was rejected by at least one party. The dispute has been escalated to <strong>Kleros Court</strong>.</p>
       ${p.amount ? `<p>Arbitration fee: <strong>$${p.amount.toLocaleString()}</strong> per party</p>` : ""}
       ${p.deadline ? `<p>Payment deadline: <strong>${p.deadline.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</strong></p>` : ""}
       <p style="margin-top:12px;padding:12px;background:#fce4ec;border-radius:6px;">Action required: You must pay the arbitration fee before the deadline, or you will lose the dispute by default.</p>`,
  },
  dispute_fee_paid: {
    subject: (p) => `Arbitration fee paid: ${p.contractTitle}`,
    body: (p) =>
      `<p>${p.actorName || "The other party"} has paid their arbitration fee for the dispute on <strong>${p.contractTitle}</strong>.</p>
       <p style="margin-top:12px;padding:12px;background:#fff3e0;border-radius:6px;">Action required: If you haven't paid yet, pay your arbitration fee before the deadline to avoid losing by default.</p>`,
  },
  dispute_deadline_default: {
    subject: (p) => `Dispute decided by default: ${p.contractTitle}`,
    body: (p) =>
      `<p>The arbitration fee deadline for the dispute on <strong>${p.contractTitle}</strong> has expired.</p>
       ${p.winner ? `<p>Default ruling: <strong>${p.winner}</strong> wins because the other party did not pay the arbitration fee in time.</p>` : ""}
       <p style="margin-top:12px;padding:12px;background:#e8f5e9;border-radius:6px;">The dispute has been resolved and the contract status updated.</p>`,
  },
  contract_completed: {
    subject: (p) => `Contract completed: ${p.contractTitle}`,
    body: (p) =>
      `<p>All milestones on <strong>${p.contractTitle}</strong> have been approved.</p>
       <p>The contract is now <strong>completed</strong> and all escrowed funds have been released.</p>
       <p style="margin-top:12px;padding:12px;background:#e8f5e9;border-radius:6px;">Thank you for using TrustSignal. View the contract for a full summary.</p>`,
  },
  contract_refunded: {
    subject: (p) => `Contract cancelled: ${p.contractTitle}`,
    body: (p) =>
      `<p>The contract <strong>${p.contractTitle}</strong> has been cancelled and the escrow has been refunded to the client.</p>
       ${p.amount ? `<p>Refunded amount: <strong>$${p.amount.toLocaleString()}</strong></p>` : ""}
       <p style="margin-top:12px;padding:12px;background:#fce4ec;border-radius:6px;">All outstanding milestones have been marked as failed. No further action is needed.</p>`,
  },
  investment_received: {
    subject: (p) => `New investment: ${p.contractTitle}`,
    body: (p) =>
      `<p>An investor${p.investorName ? ` (<strong>${p.investorName}</strong>)` : ""} has purchased tokens for your contract <strong>${p.contractTitle}</strong>.</p>
       ${p.tokenAmount ? `<p>Tokens purchased: <strong>${p.tokenAmount.toLocaleString()}</strong></p>` : ""}
       ${p.amount ? `<p>Total investment: <strong>$${p.amount.toLocaleString()}</strong></p>` : ""}
       <p style="margin-top:12px;padding:12px;background:#e8f5e9;border-radius:6px;">Your contract is gaining investor interest. Keep delivering great work!</p>`,
  },
  evidence_submitted: {
    subject: (p) => `New evidence submitted: ${p.contractTitle}`,
    body: (p) =>
      `<p>${p.actorName || "The other party"} has submitted new evidence in the dispute on <strong>${p.contractTitle}</strong>.</p>
       <p style="margin-top:12px;padding:12px;background:#fff3e0;border-radius:6px;">Review the evidence in the dispute details to stay informed.</p>`,
  },
};

export async function sendNotification(params: NotificationParams): Promise<boolean> {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not configured — skipping notification");
    return false;
  }

  const config = NOTIFICATION_CONFIG[params.type];
  const contractUrl = `${APP_URL}/contracts/${params.contractId}`;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: config.subject(params),
      html: buildNotificationHtml(config.body(params), params.contractTitle, contractUrl),
    });
    return true;
  } catch (error) {
    console.error(`[email] Failed to send ${params.type} notification:`, error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// notifyUser — lookup user by wallet and send if they have an email
// ---------------------------------------------------------------------------

export async function notifyUser(
  address: string,
  params: Omit<NotificationParams, "to">,
): Promise<void> {
  try {
    const { db } = await import("@/lib/db");
    const user = await db.users.findByAddress(address);
    if (user?.email) {
      sendNotification({ ...params, to: user.email }).catch((err) =>
        console.error(`[email] Failed to notify ${address.slice(0, 10)}:`, err),
      );
    }
  } catch (err) {
    console.error(`[email] notifyUser lookup failed for ${address.slice(0, 10)}:`, err);
  }
}

// ---------------------------------------------------------------------------
// HTML templates
// ---------------------------------------------------------------------------

function buildNotificationHtml(bodyHtml: string, contractTitle: string, contractUrl: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #1a5c35 0%, #2E8B57 100%); padding: 24px 32px;">
        <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.3px;">TrustSignal</h1>
      </div>
      <div style="padding: 32px;">
        <div style="border-left: 3px solid #2E8B57; padding-left: 16px; margin-bottom: 24px;">
          ${bodyHtml}
        </div>
        <a href="${contractUrl}" style="display: inline-block; background: #2E8B57; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
          View Contract
        </a>
      </div>
      <div style="padding: 16px 32px; background: #f8f9fa; border-top: 1px solid #e9ecef;">
        <p style="margin: 0; font-size: 12px; color: #868e96;">
          You received this email because you are a party to a contract on <a href="${APP_URL}" style="color: #2E8B57; text-decoration: none;">TrustSignal</a>.
          Check agency reputation on the <a href="${APP_URL}/oracle" style="color: #2E8B57; text-decoration: none;">Trust Oracle</a>.
        </p>
      </div>
    </div>
  `;
}

function buildInviteHtml(params: {
  contractTitle: string;
  inviterName: string;
  inviterRole: "client" | "agency";
  inviteUrl: string;
  totalValue: number;
}): string {
  const otherRole = params.inviterRole === "agency" ? "client" : "agency";
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #1a5c35 0%, #2E8B57 100%); padding: 24px 32px;">
        <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.3px;">TrustSignal</h1>
      </div>
      <div style="padding: 32px;">
        <p><strong>${params.inviterName}</strong> has invited you as the <strong>${otherRole}</strong> on a new contract.</p>
        <div style="border-left: 3px solid #2E8B57; padding-left: 16px; margin: 20px 0;">
          <p style="margin: 0 0 8px; font-weight: 600; font-size: 16px;">${params.contractTitle}</p>
          <p style="margin: 0; color: #495057;">Contract value: <strong>$${params.totalValue.toLocaleString()}</strong></p>
        </div>
        <a href="${params.inviteUrl}" style="display: inline-block; background: #2E8B57; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
          Review & Accept Contract
        </a>
        <p style="margin-top: 20px; font-size: 13px; color: #868e96;">
          You'll be asked to sign in to create your wallet. Your identity stays private.
        </p>
      </div>
      <div style="padding: 16px 32px; background: #f8f9fa; border-top: 1px solid #e9ecef;">
        <p style="margin: 0; font-size: 12px; color: #868e96;">
          You received this email because someone invited you to a contract on <a href="${APP_URL}" style="color: #2E8B57; text-decoration: none;">TrustSignal</a>.
        </p>
      </div>
    </div>
  `;
}

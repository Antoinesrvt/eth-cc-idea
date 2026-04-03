import { type NextRequest } from "next/server";
import { z } from "zod";
import { db, ensureInit } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { isBlockchainConfigured, refundMilestone } from "@/lib/blockchain";
import { notifyUser } from "@/lib/email";

// --- Zod schemas for each action ---

const CreateActionSchema = z.object({
  action: z.literal("create"),
  milestoneId: z.number().int().positive(),
  argument: z.string().min(1),
});

const PayFeeActionSchema = z.object({
  action: z.literal("pay_fee"),
  disputeId: z.string().min(1),
});

const CheckDeadlineActionSchema = z.object({
  action: z.literal("check_deadline"),
  disputeId: z.string().min(1),
});

const SubmitEvidenceActionSchema = z.object({
  action: z.literal("submit_evidence"),
  disputeId: z.string().min(1),
  evidenceUri: z.string().min(1),
  description: z.string().min(1),
});

const DisputeActionSchema = z.discriminatedUnion("action", [
  CreateActionSchema,
  PayFeeActionSchema,
  CheckDeadlineActionSchema,
  SubmitEvidenceActionSchema,
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureInit();
    const { id } = await params;

    // Auth: either party can participate in disputes
    const auth = await requireRole(request, id, "party");
    if ("error" in auth) return auth.error;
    const { walletAddress } = auth;

    const body = await request.json();
    const parsed = DisputeActionSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const contract = await db.contracts.findById(id);
    if (!contract) {
      return Response.json({ error: "Contract not found" }, { status: 404 });
    }

    const data = parsed.data;

    // Determine the caller's role on this contract (case-insensitive)
    const callerRole: "client" | "agency" =
      walletAddress?.toLowerCase() === contract.client?.toLowerCase() ? "client" : "agency";

    switch (data.action) {
      case "create":
        return handleCreate(id, contract, data, callerRole);
      case "pay_fee":
        return handlePayFee(id, data, callerRole);
      case "check_deadline":
        return handleCheckDeadline(id, data);
      case "submit_evidence":
        return handleSubmitEvidence(data, callerRole);
    }
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}

// --- Action handlers ---

async function handleCreate(
  contractId: string,
  contract: NonNullable<Awaited<ReturnType<typeof db.contracts.findById>>>,
  data: z.infer<typeof CreateActionSchema>,
  callerRole: "client" | "agency",
) {
  const milestone = contract.milestones.find(
    (m) => m.id === data.milestoneId,
  );
  if (!milestone) {
    return Response.json({ error: "Milestone not found" }, { status: 404 });
  }

  if (milestone.status !== "delivered" && milestone.status !== "rejected") {
    return Response.json(
      {
        error:
          "Milestone must be in 'delivered' or 'rejected' status to dispute",
      },
      { status: 400 },
    );
  }

  const initiatedBy = callerRole;

  // Mark milestone as disputed
  await db.contracts.updateMilestone(contractId, data.milestoneId, {
    status: "disputed",
  });
  await db.contracts.update(contractId, { status: "disputed" });

  // Create dispute record — goes straight to evidence phase
  const dispute = await db.disputes.createDispute({
    contractId,
    milestoneId: data.milestoneId,
    phase: "evidence",
    initiatedBy,
    partyResponses: [],
    clientFeePaid: false,
    agencyFeePaid: false,
    evidence: [
      {
        party: initiatedBy,
        type: "argument",
        uri: "",
        description: data.argument,
        submittedAt: new Date(),
      },
    ],
  });

  // Notify the other party about the dispute
  const otherPartyAddress = callerRole === "client" ? contract.agency : contract.client;
  if (otherPartyAddress) {
    notifyUser(otherPartyAddress, {
      type: "dispute_started",
      contractTitle: contract.title,
      contractId,
      milestoneName: milestone?.name,
    });
  }

  const updatedDispute = await db.disputes.findById(dispute.id) ?? dispute;
  return Response.json(updatedDispute, { status: 201 });
}

async function handlePayFee(
  contractId: string,
  data: z.infer<typeof PayFeeActionSchema>,
  callerRole: "client" | "agency",
) {
  const dispute = await db.disputes.findById(data.disputeId);
  if (!dispute) {
    return Response.json({ error: "Dispute not found" }, { status: 404 });
  }

  if (dispute.contractId !== contractId) {
    return Response.json(
      { error: "Dispute does not belong to this contract" },
      { status: 400 },
    );
  }

  const party = callerRole;

  // Check if this party already paid
  if ((party === "client" && dispute.clientFeePaid) || (party === "agency" && dispute.agencyFeePaid)) {
    return Response.json({ error: "You have already paid the arbitration fee" }, { status: 400 });
  }

  const contract = await db.contracts.findById(contractId);

  await db.disputes.recordFeePaid(data.disputeId, party);
  const updated = (await db.disputes.findById(data.disputeId))!;

  // Notify the other party that this party paid their fee
  if (contract) {
    const otherPartyAddress = party === "client" ? contract.agency : contract.client;
    if (otherPartyAddress) {
      notifyUser(otherPartyAddress, {
        type: "dispute_fee_paid",
        contractTitle: contract.title,
        contractId,
        actorName: party === "client" ? "The client" : "The agency",
      });
    }
  }

  // If both parties paid, escalate to Kleros review (on-chain Kleros not yet wired)
  if (updated.clientFeePaid && updated.agencyFeePaid) {
    await db.disputes.update(data.disputeId, { phase: "kleros_review" });
    console.log("[court] Both fees paid — escalated to kleros_review (DB only)");
  }

  const finalDispute = (await db.disputes.findById(data.disputeId))!;
  return Response.json(finalDispute);
}

async function handleCheckDeadline(
  contractId: string,
  data: z.infer<typeof CheckDeadlineActionSchema>,
) {
  const dispute = await db.disputes.findById(data.disputeId);
  if (!dispute) {
    return Response.json({ error: "Dispute not found" }, { status: 404 });
  }

  if (dispute.contractId !== contractId) {
    return Response.json(
      { error: "Dispute does not belong to this contract" },
      { status: 400 },
    );
  }

  const result = await db.disputes.checkFeeDeadline(data.disputeId);

  if (result.expired && result.defaultWinner) {
    // Resolve dispute — the party that didn't pay loses by default
    const milestoneStatus =
      result.defaultWinner === "client" ? "failed" : "approved";
    await db.contracts.updateMilestone(contractId, dispute.milestoneId, {
      status: milestoneStatus,
      ...(milestoneStatus === "approved" ? { approvedAt: new Date() } : {}),
    });
    await db.disputes.update(data.disputeId, {
      phase: "resolved",
      resolvedAt: new Date(),
      ruling: result.defaultWinner === "client" ? 1 : 2,
    });

    // Restore contract status
    const freshContract = await db.contracts.findById(contractId);
    if (freshContract) {
      const allDone = freshContract.milestones.every(
        (m) => m.status === "approved" || m.status === "failed",
      );
      if (allDone) {
        const allApproved = freshContract.milestones.every(
          (m) => m.status === "approved",
        );
        await db.contracts.update(contractId, {
          status: allApproved ? "completed" : "failed",
        });
      } else {
        await db.contracts.update(contractId, { status: "active" });
      }
    }

    // Refund milestone on-chain if client wins by default
    if (result.defaultWinner === "client" && isBlockchainConfigured() && freshContract?.onChainAddress) {
      try {
        const txHash = await refundMilestone(freshContract.onChainAddress, dispute.milestoneId);
        console.log("[dispute/deadline] On-chain refundMilestone success:", txHash);
      } catch (err) {
        console.warn("[dispute/deadline] On-chain refundMilestone failed:", err);
      }
    }

    // Notify both parties of the default ruling
    if (freshContract) {
      const defaultNotif = {
        type: "dispute_deadline_default" as const,
        contractTitle: freshContract.title,
        contractId,
        winner: result.defaultWinner === "client"
          ? "Client wins by default — agency did not pay arbitration fee"
          : "Agency wins by default — client did not pay arbitration fee",
      };
      if (freshContract.client) notifyUser(freshContract.client, defaultNotif);
      if (freshContract.agency) notifyUser(freshContract.agency, defaultNotif);
    }
  }

  const finalDispute = (await db.disputes.findById(data.disputeId))!;
  return Response.json({ dispute: finalDispute, ...result });
}

async function handleSubmitEvidence(
  data: z.infer<typeof SubmitEvidenceActionSchema>,
  callerRole: "client" | "agency",
) {
  const dispute = await db.disputes.findById(data.disputeId);
  if (!dispute) {
    return Response.json({ error: "Dispute not found" }, { status: 404 });
  }

  if (dispute.phase === "resolved") {
    return Response.json(
      { error: "Cannot submit evidence to a resolved dispute" },
      { status: 400 },
    );
  }

  const updatedDispute = await db.disputes.addEvidence(data.disputeId, {
    party: callerRole,
    type: "document",
    uri: data.evidenceUri,
    description: data.description,
    submittedAt: new Date(),
  });

  // Notify the other party that evidence was submitted
  const contract = await db.contracts.findById(dispute.contractId);
  if (contract) {
    const otherPartyAddress = callerRole === "client" ? contract.agency : contract.client;
    if (otherPartyAddress) {
      notifyUser(otherPartyAddress, {
        type: "evidence_submitted",
        contractTitle: contract.title,
        contractId: dispute.contractId,
        actorName: callerRole === "client" ? "The client" : "The agency",
      });
    }
  }

  return Response.json(updatedDispute);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureInit();
    const { id } = await params;
    const disputes = await db.disputes.findByContract(id);
    return Response.json(disputes);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}

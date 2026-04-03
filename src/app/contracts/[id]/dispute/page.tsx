"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Scale, CheckCircle, XCircle, AlertTriangle,
  ExternalLink, Clock, Loader2, DollarSign, Gavel,
  ShieldCheck, Timer, FileText, Send,
} from "lucide-react";
import {
  useContract,
  useDisputes,
  startDispute,
  payKlerosFee,
  submitDisputeEvidence,
} from "@/hooks/use-contracts";
import { useAuth } from "@/hooks/use-auth";
import type { Dispute, DisputePhase } from "@/lib/types";
import { toast } from "sonner";
import { Button, TextArea, Spinner } from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PageHeader, SectionCard, EvidenceTag,
} from "@/components/ui";
import { formatCurrency } from "@/lib/utils/format";

// ─── Phase definitions ────────────────────────────────────────────────────────
const PHASES: { key: DisputePhase; label: string; icon: typeof Scale }[] = [
  { key: "evidence", label: "Evidence", icon: FileText },
  { key: "kleros_payment", label: "Fee Deposit", icon: DollarSign },
  { key: "kleros_review", label: "Court Review", icon: Scale },
  { key: "resolved", label: "Resolved", icon: CheckCircle },
];

const PHASE_TITLES: Record<DisputePhase, string> = {
  evidence: "Evidence Submission",
  kleros_payment: "Arbitration Fee Required",
  kleros_review: "Court Review",
  resolved: "Dispute Resolved",
};

function phaseIndex(phase: DisputePhase): number {
  return PHASES.findIndex((p) => p.key === phase);
}

// ─── Countdown hook ───────────────────────────────────────────────────────────
function useCountdown(deadline: Date | undefined) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!deadline) return;
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline) return null;

  const diff = new Date(deadline).getTime() - now;
  if (diff <= 0) return { expired: true, days: 0, hours: 0, text: "Expired" };

  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const text =
    days > 0 ? `${days}d ${hours}h remaining` : `${hours}h remaining`;

  return { expired: false, days, hours, text };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DisputePage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const milestoneParam = searchParams.get("milestone");

  const { walletAddress } = useAuth();
  const { contract, loading: contractLoading } = useContract(id);
  const {
    data: disputes,
    loading: disputesLoading,
    refresh: refreshDisputes,
  } = useDisputes(id);

  const [argument, setArgument] = useState("");
  const [evidenceDesc, setEvidenceDesc] = useState("");
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [payingFee, setPayingFee] = useState(false);
  const [submittingEvidence, setSubmittingEvidence] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loading = contractLoading || disputesLoading;

  // ─── Role detection ─────────────────────────────────────────────────────────
  const userRole: "agency" | "client" | "viewer" = useMemo(() => {
    if (!contract || !walletAddress) return "viewer";
    if (contract.agency?.toLowerCase() === walletAddress?.toLowerCase()) return "agency";
    if (contract.client?.toLowerCase() === walletAddress?.toLowerCase()) return "client";
    return "viewer";
  }, [contract, walletAddress]);

  // ─── Dispute data ───────────────────────────────────────────────────────────
  const dispute: Dispute | null = useMemo(() => {
    if (!disputes?.length) return null;
    if (milestoneParam) {
      return disputes.find((d) => d.milestoneId === Number(milestoneParam)) ?? disputes[0];
    }
    return disputes[0];
  }, [disputes, milestoneParam]);
  const phase: DisputePhase = dispute?.phase ?? "evidence";
  const currentPhaseIdx = phaseIndex(phase);
  const countdown = useCountdown(dispute?.feeDeadline);

  const disputeMilestone = dispute
    ? contract?.milestones.find((m) => m.id === dispute.milestoneId)
    : milestoneParam
      ? contract?.milestones.find((m) => m.id === Number(milestoneParam))
      : null;

  const milestoneName = disputeMilestone?.name ?? "Milestone";
  const milestoneAmount = disputeMilestone?.amount ?? 0;

  const myFeePaid =
    userRole === "client"
      ? dispute?.clientFeePaid
      : userRole === "agency"
        ? dispute?.agencyFeePaid
        : false;
  const otherFeePaid =
    userRole === "client"
      ? dispute?.agencyFeePaid
      : userRole === "agency"
        ? dispute?.clientFeePaid
        : false;

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handleCreateDispute = async () => {
    if (!argument.trim()) return;
    const msId =
      milestoneParam != null
        ? Number(milestoneParam)
        : contract?.milestones.find((m) => m.status === "rejected")?.id;
    if (msId == null) {
      setError("No milestone selected for dispute");
      return;
    }
    setSubmittingDispute(true);
    setError(null);
    try {
      await startDispute(id, msId, argument.trim());
      toast.success("Dispute submitted");
      setArgument("");
      refreshDisputes();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create dispute";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmittingDispute(false);
    }
  };

  const handlePayFee = async () => {
    if (!dispute) return;
    setPayingFee(true);
    setError(null);
    try {
      await payKlerosFee(id, dispute.id);
      toast.success("Fee paid");
      refreshDisputes();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to pay fee";
      setError(msg);
      toast.error(msg);
    } finally {
      setPayingFee(false);
    }
  };

  const handleSubmitEvidence = async () => {
    if (!dispute || !evidenceDesc.trim()) return;
    setSubmittingEvidence(true);
    setError(null);
    try {
      await submitDisputeEvidence(id, dispute.id, "", evidenceDesc.trim());
      toast.success("Evidence submitted");
      setEvidenceDesc("");
      refreshDisputes();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit evidence";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmittingEvidence(false);
    }
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" className="text-accent" />
        </div>
      </div>
    );
  }

  // ─── No dispute yet ──────────────────────────────────────────────────────
  if (!dispute) {
    if (!milestoneParam) {
      return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <PageHeader
            title="Disputes"
            description="No active disputes on this contract"
            backHref={`/contracts/${id}`}
            backLabel="Back to Contract"
          />
          <div className="rounded-xl border border-border bg-surface-secondary p-8 text-center">
            <Scale className="h-12 w-12 text-muted mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No active disputes</p>
            <p className="text-xs text-muted mb-4">
              There are no open disputes on this contract. If a milestone has been rejected, you can start a dispute from the contract page.
            </p>
            <Link
              href={`/contracts/${id}`}
              className="text-sm text-accent hover:underline"
            >
              Back to Contract
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PageHeader
          title="Start a Dispute"
          description={
            disputeMilestone
              ? `You're disputing milestone: ${milestoneName} (${formatCurrency(milestoneAmount)})`
              : "Dispute a milestone"
          }
          backHref={`/contracts/${id}`}
          backLabel="Back to Contract"
        />

        {/* Context banner */}
        <div className="mb-6 p-4 rounded-xl border border-warning/30 bg-warning/5 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground mb-0.5">About this dispute</p>
            <p className="text-sm text-muted">
              You are disputing <span className="font-semibold text-foreground">{milestoneName}</span> — {formatCurrency(milestoneAmount)}.
              Both parties will submit evidence. If the dispute cannot be resolved, it escalates to Kleros decentralized court.
            </p>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6"
            >
              <div className="flex items-center gap-3 p-4 rounded-xl border border-danger/30 bg-danger/5 text-sm text-danger">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
                <button
                  onClick={() => setError(null)}
                  className="ml-auto text-danger/60 hover:text-danger"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <SectionCard
          title="Your Argument"
          icon={<FileText className="h-5 w-5 text-accent" />}
          className="mb-6"
        >
          <p className="text-sm text-muted mb-4">
            Explain clearly why the delivered work does or does not meet the contract requirements.
            Be specific — Kleros jurors will review your argument alongside all evidence.
            <span className="text-xs text-muted block mt-1">Minimum 50 characters required.</span>
          </p>
          <TextArea
            value={argument}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setArgument(e.target.value)
            }
            placeholder="Describe why the deliverable does or does not meet the contract specification. Reference specific requirements..."
            className="w-full resize-none mb-1"
          />
          <p className={`text-xs mb-4 ${argument.length > 0 && argument.trim().length < 50 ? "text-warning" : "text-muted"}`}>
            {argument.trim().length} / 50 characters minimum
          </p>
          <Button
            onPress={handleCreateDispute}
            isDisabled={submittingDispute || argument.trim().length < 50}
            className="bg-accent text-accent-foreground text-sm font-semibold rounded-lg px-6"
          >
            {submittingDispute ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Dispute
              </>
            )}
          </Button>
        </SectionCard>

        <div className="rounded-xl border border-border bg-surface-secondary p-5">
          <h4 className="text-sm font-semibold mb-3">How disputes work</h4>
          <ol className="space-y-2 text-xs text-muted list-decimal list-inside">
            <li>
              <span className="text-foreground font-medium">Evidence phase:</span>{" "}
              Both parties submit their arguments and supporting documents
            </li>
            <li>
              <span className="text-foreground font-medium">Kleros fee:</span>{" "}
              Both parties deposit the arbitration fee (1 month deadline)
            </li>
            <li>
              <span className="text-foreground font-medium">Kleros Court:</span>{" "}
              Decentralized jurors review all evidence and rule
            </li>
          </ol>
        </div>
      </div>
    );
  }

  // ─── Main dispute view ────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <PageHeader
        title={PHASE_TITLES[phase]}
        description={`Milestone: ${milestoneName} — ${formatCurrency(milestoneAmount)}`}
        backHref={`/contracts/${id}`}
        backLabel="Back to Contract"
      />

      {/* ── Phase Timeline ──────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-1 p-4 rounded-xl border border-border bg-surface overflow-x-auto">
          {PHASES.map((p, i) => {
            const isActive = p.key === phase;
            const isDone = i < currentPhaseIdx;
            const Icon = p.icon;

            return (
              <div key={p.key} className="flex items-center gap-1 flex-1 min-w-0">
                <div className="flex flex-col items-center gap-1 min-w-[48px]">
                  <motion.div
                    initial={false}
                    animate={{ scale: isActive ? 1.1 : 1 }}
                    className={`flex items-center justify-center h-9 w-9 rounded-full ${
                      isDone
                        ? "bg-success"
                        : isActive
                          ? "bg-accent"
                          : "bg-surface-secondary"
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle className="h-4 w-4 text-success-foreground" />
                    ) : (
                      <Icon
                        className={`h-4 w-4 ${isActive ? "text-accent-foreground" : "text-muted"}`}
                      />
                    )}
                  </motion.div>
                  <span
                    className={`text-[10px] text-center leading-tight whitespace-nowrap ${
                      isActive
                        ? "text-foreground font-semibold"
                        : isDone
                          ? "text-success"
                          : "text-muted"
                    }`}
                  >
                    {p.label}
                  </span>
                </div>
                {i < PHASES.length - 1 && (
                  <div
                    className={`flex-1 h-px mx-1 ${
                      isDone ? "bg-success" : "bg-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-6"
          >
            <div className="flex items-center gap-3 p-4 rounded-xl border border-danger/30 bg-danger/5 text-sm text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-auto text-danger/60 hover:text-danger"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Evidence Phase ─────────────────────────────────────────────────── */}
      {phase === "evidence" && (
        <SectionCard
          title="Submit Evidence"
          icon={<FileText className="h-5 w-5 text-accent" />}
          className="mb-6"
        >
          <p className="text-sm text-muted mb-4">
            Both parties can submit evidence during this phase. Once evidence is gathered,
            both parties need to pay the Kleros arbitration fee to proceed.
          </p>
          <TextArea
            value={evidenceDesc}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEvidenceDesc(e.target.value)}
            placeholder="Describe your evidence (links, screenshots, documents, arguments)..."
            className="w-full resize-none mb-3"
          />
          <Button
            onPress={handleSubmitEvidence}
            isDisabled={submittingEvidence || !evidenceDesc.trim()}
            className="bg-accent text-accent-foreground text-sm font-semibold rounded-lg px-5"
          >
            {submittingEvidence ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</>
            ) : (
              <><Send className="h-4 w-4 mr-2" />Submit Evidence</>
            )}
          </Button>
        </SectionCard>
      )}

      {/* ── Kleros Payment Phase ───────────────────────────────────────────── */}
      {phase === "kleros_payment" && (
        <SectionCard
          title="Pay Arbitration Fee"
          icon={<DollarSign className="h-5 w-5 text-warning" />}
          className="mb-6 border-warning/30"
        >
          {countdown && (
            <div className={`mb-4 flex items-center gap-2 text-sm ${countdown.expired ? "text-danger" : "text-warning"}`}>
              <Timer className="h-4 w-4 shrink-0" />
              <span>Deadline: {countdown.text}</span>
            </div>
          )}
          <p className="text-sm text-muted mb-4">
            Both parties must pay the Kleros arbitration fee to proceed.
            If one party does not pay within the deadline, they lose by default.
          </p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className={`p-3 rounded-lg border text-center ${dispute.clientFeePaid ? "border-success/30 bg-success/5" : "border-border bg-surface-secondary"}`}>
              <p className="text-xs text-muted mb-1">Client</p>
              {dispute.clientFeePaid
                ? <CheckCircle className="h-5 w-5 text-success mx-auto" />
                : <Clock className="h-5 w-5 text-warning mx-auto" />}
              <p className="text-xs font-medium mt-1">{dispute.clientFeePaid ? "Paid" : "Pending"}</p>
            </div>
            <div className={`p-3 rounded-lg border text-center ${dispute.agencyFeePaid ? "border-success/30 bg-success/5" : "border-border bg-surface-secondary"}`}>
              <p className="text-xs text-muted mb-1">Agency</p>
              {dispute.agencyFeePaid
                ? <CheckCircle className="h-5 w-5 text-success mx-auto" />
                : <Clock className="h-5 w-5 text-warning mx-auto" />}
              <p className="text-xs font-medium mt-1">{dispute.agencyFeePaid ? "Paid" : "Pending"}</p>
            </div>
          </div>

          {!myFeePaid && userRole !== "viewer" && (
            <Button
              onPress={handlePayFee}
              isDisabled={payingFee}
              className="bg-warning text-warning-foreground text-sm font-semibold rounded-lg px-5"
            >
              {payingFee ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing...</>
              ) : (
                <>Pay Arbitration Fee ({dispute.arbitrationFee?.toFixed(4) ?? "0.1"} ETH)</>
              )}
            </Button>
          )}

          {myFeePaid && !otherFeePaid && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Waiting for the other party to pay...
            </div>
          )}
        </SectionCard>
      )}

      {/* ── Kleros Review Phase ────────────────────────────────────────────── */}
      {phase === "kleros_review" && (
        <SectionCard
          title="Kleros Court Review"
          icon={<Gavel className="h-5 w-5 text-accent" />}
          className="mb-6"
        >
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Case submitted to Kleros</p>
              <p className="text-sm text-muted mb-3">
                Decentralized jurors are reviewing the evidence. The ruling will be enforced automatically.
              </p>
              {dispute.klerosDisputeId && (
                <a
                  href={`https://kleros.io/cases/${dispute.klerosDisputeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
                >
                  View on Kleros <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {/* ── Resolved Phase ─────────────────────────────────────────────────── */}
      {phase === "resolved" && (
        <SectionCard
          title="Dispute Resolved"
          icon={<CheckCircle className="h-5 w-5 text-success" />}
          className="mb-6 border-success/30"
        >
          <p className="text-sm text-muted">
            {dispute.ruling === 1
              ? "Client won — milestone rejected and funds refunded."
              : dispute.ruling === 2
                ? "Agency won — milestone approved and funds released."
                : "Dispute resolved."}
          </p>
        </SectionCard>
      )}

      {/* ── Evidence log ───────────────────────────────────────────────────── */}
      {dispute.evidence && dispute.evidence.length > 0 && (
        <SectionCard title="Evidence Log" className="mb-6">
          <div className="space-y-3">
            {dispute.evidence.map((ev, i) => (
              <div key={i} className="p-3 rounded-lg border border-border bg-surface-secondary">
                <div className="flex items-center gap-2 mb-1">
                  <EvidenceTag type={ev.type} />
                  <span className="text-xs text-muted capitalize">{ev.party}</span>
                </div>
                <p className="text-sm text-foreground">{ev.description}</p>
                {ev.uri && (
                  <a
                    href={ev.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-accent hover:underline mt-1"
                  >
                    View evidence <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Evidence submission during kleros_review */}
      {phase !== "resolved" && (
        <SectionCard title="Add Evidence" className="mb-6">
          <TextArea
            value={evidenceDesc}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEvidenceDesc(e.target.value)}
            placeholder="Add more evidence or arguments..."
            className="w-full resize-none mb-3"
          />
          <Button
            onPress={handleSubmitEvidence}
            isDisabled={submittingEvidence || !evidenceDesc.trim()}
            size="sm"
            className="bg-accent text-accent-foreground text-sm font-semibold rounded-lg px-5"
          >
            {submittingEvidence ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</>
            ) : (
              <><Send className="h-4 w-4 mr-2" />Add Evidence</>
            )}
          </Button>
        </SectionCard>
      )}
    </div>
  );
}

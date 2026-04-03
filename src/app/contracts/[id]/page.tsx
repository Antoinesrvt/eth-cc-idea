"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle, Clock, AlertTriangle, XCircle,
  Coins, Upload, ExternalLink, Loader2, Eye, ShieldAlert, Wallet, Zap, Mail,
} from "lucide-react";
import {
  useContract,
  approveMilestone,
  rejectMilestone,
} from "@/hooks/use-contracts";
import { useAuth } from "@/hooks/use-auth";
import { postApi } from "@/hooks/use-api";
import {
  Card, CardContent, CardHeader, Button, Spinner, TextArea,
} from "@heroui/react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { truncateMiddle, formatCurrency } from "@/lib/utils/format";
import {
  StatusBadge, LabeledProgress, PageHeader,
} from "@/components/ui";
import type { Milestone } from "@/lib/types";

type UserRole = "agency" | "client" | "investor" | "public";

// ─── Component ────────────────────────────────────────────────────────────────
export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { walletAddress, authenticated, login, getAuthToken } = useAuth();
  const { contract, escrow, blockchainEvents, loading, error, refresh } = useContract(id);

  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // ─── Role detection ─────────────────────────────────────────────────────────
  const isTokenized = !!contract?.tokenizationExposure;
  const userRole: UserRole =
    contract?.agency?.toLowerCase() === walletAddress?.toLowerCase() ? "agency"
    : contract?.client?.toLowerCase() === walletAddress?.toLowerCase() ? "client"
    : (authenticated && isTokenized) ? "investor"
    : "public";

  // Parse exposure settings for investor filtering
  const exposure = contract?.tokenizationExposure
    ? (JSON.parse(contract.tokenizationExposure) as { showDescription: boolean; showMilestones: boolean; showDisputeHistory: boolean })
    : { showDescription: false, showMilestones: false, showDisputeHistory: false };

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handleApprove = async (milestoneId: number) => {
    setApprovingId(milestoneId);
    setActionError(null);
    try {
      await approveMilestone(id, milestoneId);
      toast.success("Milestone approved");
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to approve milestone";
      setActionError(msg);
      toast.error(msg);
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (milestoneId: number) => {
    if (!rejectReason.trim()) return;
    setRejectingId(milestoneId);
    setActionError(null);
    try {
      await rejectMilestone(id, milestoneId, rejectReason.trim());
      toast.success("Milestone rejected");
      setShowRejectForm(null);
      setRejectReason("");
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reject milestone";
      setActionError(msg);
      toast.error(msg);
    } finally {
      setRejectingId(null);
    }
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" className="text-accent" />
      </div>
    );
  }

  // ─── Invite required ──────────────────────────────────────────────────────
  if (error?.includes("invitation to join")) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
        <Card className="border border-warning/30 bg-warning/5 rounded-xl shadow-none">
          <CardContent className="p-6 text-center">
            <Mail className="h-8 w-8 text-warning mx-auto mb-3" />
            <p className="font-medium mb-2">This contract requires an invitation</p>
            <p className="text-sm text-muted">
              Check your email for the invite link from the contract creator,
              or ask them to share the invite URL with you.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────
  if (error || !contract) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
        <Card className="border border-danger/30 bg-danger/5 rounded-xl shadow-none">
          <CardContent className="p-6 text-center text-danger font-medium">
            {error ?? "Contract not found"}
          </CardContent>
        </Card>
      </div>
    );
  }

  const deposited = escrow?.depositedAmount ?? 0;
  const released = escrow?.releasedAmount ?? 0;
  const escrowPct =
    contract.totalValue > 0
      ? Math.round((released / contract.totalValue) * 100)
      : 0;

  // ─── Helper: who needs to act? ─────────────────────────────────────────────
  function getActionLabel(m: Milestone): {
    text: string;
    highlight: "agency" | "client" | null;
  } {
    switch (m.status) {
      case "pending":
        return { text: "Waiting for agency to deliver", highlight: "agency" };
      case "delivered":
        return { text: "Waiting for client review", highlight: "client" };
      case "rejected":
        return { text: "Waiting for agency response", highlight: "agency" };
      case "approved":
        return { text: "Completed", highlight: null };
      case "disputed":
        return { text: "In dispute", highlight: null };
      default:
        return { text: "", highlight: null };
    }
  }

  // ─── Helper: milestone timeline events ──────────────────────────────────────
  function getMilestoneTimeline(m: Milestone) {
    const events: { label: string; date?: Date }[] = [];
    if (m.deliveredAt) events.push({ label: "Delivered", date: new Date(m.deliveredAt) });
    if (m.approvedAt) events.push({ label: "Approved", date: new Date(m.approvedAt) });
    if (m.status === "rejected") events.push({ label: "Rejected" });
    if (m.status === "disputed") events.push({ label: "Disputed" });
    return events;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Back */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-8 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground truncate">
              {contract.title}
            </h1>
            <StatusBadge
              status={
                contract.status as
                  | "draft"
                  | "active"
                  | "completed"
                  | "disputed"
              }
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
            <span>
              Agency:{" "}
              <span
                className={`font-semibold ${userRole === "agency" ? "text-accent" : "text-foreground"}`}
              >
                {userRole === "agency"
                  ? "You"
                  : truncateMiddle(contract.agency, 6, 4)}
              </span>
            </span>
            {userRole !== "investor" && userRole !== "public" && (
              <>
                <span className="w-px h-3 bg-border" />
                <span>
                  Client:{" "}
                  <span
                    className={`font-semibold ${userRole === "client" ? "text-accent" : "text-foreground"}`}
                  >
                    {userRole === "client"
                      ? "You"
                      : truncateMiddle(contract.client, 6, 4)}
                  </span>
                </span>
              </>
            )}
            {userRole === "investor" && (
              <>
                <span className="w-px h-3 bg-border" />
                <span className="inline-flex items-center gap-1 text-xs text-muted">
                  <Eye className="h-3 w-3" /> Viewing as investor
                </span>
              </>
            )}
          </div>
        </div>
        {userRole === "agency" && contract.status === "active" && !isTokenized && (
          <Link
            href={`/contracts/${id}/tokenize`}
            className="shrink-0 inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-brand text-brand-foreground text-sm font-semibold shadow-md shadow-brand/20 hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <Coins className="h-4 w-4" /> Tokenize
          </Link>
        )}
      </div>

      {/* Action error */}
      <AnimatePresence>
        {actionError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-6"
          >
            <div className="flex items-center gap-3 p-4 rounded-xl border border-danger/30 bg-danger/5 text-sm text-danger font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {actionError}
              <button
                onClick={() => setActionError(null)}
                className="ml-auto text-danger/60 hover:text-danger"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Contract completion banner ─────────────────────────────────────── */}
      {contract.status === "completed" && (
        <div className="p-4 rounded-xl bg-success/10 border border-success/20 flex items-center gap-3 mb-6">
          <CheckCircle className="h-6 w-6 text-success shrink-0" />
          <div>
            <p className="font-semibold text-success">Contract Complete</p>
            <p className="text-sm text-success/80">All milestones approved. Funds released to agency.</p>
          </div>
          {userRole === "agency" && !contract.tokenizationExposure && (
            <Link href={`/contracts/${id}/tokenize`} className="ml-auto shrink-0">
              <Button size="sm" className="bg-accent text-accent-foreground">Tokenize</Button>
            </Link>
          )}
        </div>
      )}

      {/* ── Contract lifecycle progress bar ────────────────────────────────── */}
      {contract.status !== "cancelled" && (
        <div className="mb-6">
          {(() => {
            const steps = ["Draft", "Deposit", "Active", "Completed"];
            const statusToStep: Record<string, number> = {
              draft: 0,
              invited: 0,
              pending_deposit: 1,
              active: 2,
              completed: 3,
              disputed: 2,
            };
            const currentStep = statusToStep[contract.status] ?? 0;
            const isDisputed = contract.status === "disputed";
            return (
              <div className="flex items-center gap-0">
                {steps.map((label, i) => {
                  const isDone = i < currentStep;
                  const isActive = i === currentStep;
                  const isLast = i === steps.length - 1;
                  return (
                    <div key={label} className="flex items-center flex-1 min-w-0">
                      <div className="flex flex-col items-center flex-1 min-w-0">
                        <div
                          className={`h-2 w-full rounded-full ${
                            isDone
                              ? "bg-success"
                              : isActive
                                ? isDisputed
                                  ? "bg-danger"
                                  : "bg-accent"
                                : "bg-border"
                          }`}
                        />
                        <span
                          className={`text-xs mt-1 font-medium ${
                            isDone
                              ? "text-success"
                              : isActive
                                ? isDisputed
                                  ? "text-danger"
                                  : "text-accent"
                                : "text-muted"
                          }`}
                        >
                          {isActive && isDisputed && label === "Active" ? "Disputed" : label}
                        </span>
                      </div>
                      {!isLast && <div className="w-2 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Phase banner */}
      {contract.status !== "completed" && contract.status !== "cancelled" && (
        <div className={`p-4 rounded-xl flex items-center gap-3 mb-6 text-sm ${
          contract.status === "disputed" ? "bg-danger/10 border border-danger/20 text-danger" :
          contract.status === "active" ? "bg-accent/10 border border-accent/20 text-accent" :
          contract.status === "pending_deposit" ? "bg-warning/10 border border-warning/20 text-warning" :
          contract.status === "invited" ? "bg-info/10 border border-info/20 text-info" :
          "bg-surface-secondary border border-border text-muted"
        }`}>
          {contract.status === "invited" && (
            <><Mail className="h-5 w-5 shrink-0" /><span>Invitation sent to <strong>{contract.inviteEmail}</strong>. Waiting for them to join.</span></>
          )}
          {contract.status === "pending_deposit" && userRole === "client" && (
            <>
              <Wallet className="h-5 w-5 shrink-0" />
              <span>Deposit escrow to activate this contract. <Link href={`/contracts/${id}/deposit`} className="underline font-semibold">Deposit now</Link></span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto border-danger text-danger"
                onPress={async () => {
                  if (!confirm("Are you sure? This will cancel the contract and refund remaining escrow.")) return;
                  try {
                    const token = await getAuthToken();
                    await postApi(`/api/contracts/${id}/refund`, {}, token);
                    toast.success("Contract cancelled and refund initiated");
                    refresh();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Cancellation failed");
                  }
                }}
              >
                Cancel & Refund
              </Button>
            </>
          )}
          {contract.status === "pending_deposit" && userRole !== "client" && (
            <><Clock className="h-5 w-5 shrink-0" /><span>Waiting for client to deposit escrow.</span></>
          )}
          {contract.status === "active" && (
            <>
              <CheckCircle className="h-5 w-5 shrink-0" />
              <span>Contract is active. {contract.milestones.filter(m => m.status === "pending").length} milestone{contract.milestones.filter(m => m.status === "pending").length !== 1 ? "s" : ""} pending.</span>
              {userRole === "client" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto border-danger text-danger"
                  onPress={async () => {
                    if (!confirm("Are you sure? This will cancel the contract and refund remaining escrow.")) return;
                    try {
                      const token = await getAuthToken();
                      await postApi(`/api/contracts/${id}/refund`, {}, token);
                      toast.success("Contract cancelled and refund initiated");
                      refresh();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Cancellation failed");
                    }
                  }}
                >
                  Cancel & Refund
                </Button>
              )}
            </>
          )}
          {contract.status === "disputed" && (
            <><AlertTriangle className="h-5 w-5 shrink-0" /><span>Dispute in progress. <Link href={`/contracts/${id}/dispute`} className="underline font-semibold">View dispute</Link></span></>
          )}
          {contract.status === "failed" && (
            <>
              <XCircle className="h-5 w-5 shrink-0" />
              <span>Contract failed. Escrow refundable.</span>
              {userRole === "client" && (
                <Button
                  size="sm"
                  className="ml-auto bg-danger text-danger-foreground"
                  onPress={async () => {
                    try {
                      const token = await getAuthToken();
                      await postApi(`/api/contracts/${id}/refund`, {}, token);
                      toast.success("Refund initiated");
                      refresh();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Refund failed");
                    }
                  }}
                >
                  Request Refund
                </Button>
              )}
            </>
          )}
          {(contract.status === "draft") && (
            <><Clock className="h-5 w-5 shrink-0" /><span>Contract created. Waiting for counterparty.</span></>
          )}
        </div>
      )}

      {userRole !== "public" ? (
        <div className="grid lg:grid-cols-[1fr_300px] gap-6">
          {/* ── Main ──────────────────────────────────────────────────────────── */}
          <div className="space-y-6 min-w-0">
            {/* Escrow card — agency/client: full view; investor: progress only */}
            {(userRole === "agency" || userRole === "client") && (
              <Card className="border border-border bg-surface rounded-xl shadow-sm overflow-hidden">
                <div
                  className="h-1.5 bg-gradient-to-r from-accent to-success transition-all duration-500"
                  style={{ width: `${escrowPct}%` }}
                />
                <CardContent className="p-5 sm:p-6">
                  <h2 className="text-base font-bold mb-4 tracking-tight">
                    Escrow Status
                  </h2>
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      {
                        label: "Deposited",
                        value: formatCurrency(deposited),
                        color: "text-success",
                      },
                      {
                        label: "Released",
                        value: formatCurrency(released),
                        color: "text-accent",
                      },
                      {
                        label: "Locked",
                        value: formatCurrency(deposited - released),
                        color: "text-foreground",
                      },
                    ].map(({ label, value, color }) => (
                      <div
                        key={label}
                        className="p-3 rounded-lg bg-surface-secondary border border-border/60 text-center"
                      >
                        <div className={`text-lg font-bold tabular-nums ${color}`}>
                          {value}
                        </div>
                        <div className="text-xs text-muted mt-0.5 font-medium uppercase tracking-wider">
                          {label}
                        </div>
                      </div>
                    ))}
                  </div>
                  <LabeledProgress
                    label="Payout Progress"
                    value={escrowPct}
                    color="success"
                  />
                </CardContent>
              </Card>
            )}
            {userRole === "investor" && (
              <Card className="border border-border rounded-xl shadow-sm overflow-hidden">
                <CardContent className="p-5">
                  <LabeledProgress label="Contract Progress" value={escrowPct} />
                </CardContent>
              </Card>
            )}

            {/* Milestones */}
            <div>
              <h2 className="text-base font-bold mb-5 tracking-tight">
                Milestones
              </h2>
              {userRole === "investor" && !exposure.showMilestones ? (
                <Card className="border border-border rounded-xl p-5">
                  <p className="text-sm text-muted">Milestone details are private. {contract.milestones.filter(m => m.status === "approved").length}/{contract.milestones.length} milestones completed.</p>
                </Card>
              ) : (
                <div className="relative pl-7">
                  {contract.milestones.length > 1 && (
                    <div className="absolute left-[11px] top-5 bottom-5 w-px bg-gradient-to-b from-success/40 to-border/20" />
                  )}
                  <div className="space-y-4">
                    {contract.milestones.map((m, i) => {
                      const isApproved = m.status === "approved";
                      const isDelivered = m.status === "delivered";
                      const isRejected = m.status === "rejected";
                      const isDisputed = m.status === "disputed";
                      const isPending = m.status === "pending";
                      const actionInfo = getActionLabel(m);
                      const timeline = getMilestoneTimeline(m);

                      return (
                        <motion.div
                          key={m.id ?? i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            delay: i * 0.07,
                            type: "spring",
                            stiffness: 160,
                          }}
                          className="relative"
                        >
                          {/* Timeline dot */}
                          <div className="absolute -left-7 top-4 z-10 w-5 h-5 flex items-center justify-center">
                            {isApproved ? (
                              <CheckCircle className="h-5 w-5 text-success" />
                            ) : isDelivered ? (
                              <Clock className="h-5 w-5 text-warning" />
                            ) : isRejected ? (
                              <XCircle className="h-5 w-5 text-danger" />
                            ) : isDisputed ? (
                              <ShieldAlert className="h-5 w-5 text-danger" />
                            ) : (
                              <div className="h-3.5 w-3.5 rounded-full border-2 border-border bg-surface" />
                            )}
                          </div>

                          <Card
                            className={`border rounded-xl shadow-sm transition-all ${
                              isDelivered
                                ? "border-warning/40 bg-warning/5"
                                : isApproved
                                  ? "border-success/30 bg-success/5"
                                  : isRejected
                                    ? "border-danger/30 bg-danger/5"
                                    : isDisputed
                                      ? "border-danger/30 bg-danger/5"
                                      : "border-border bg-surface hover:border-accent/30"
                            }`}
                          >
                            <CardContent className="p-4">
                              {/* Milestone header */}
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="min-w-0">
                                  <div className="font-semibold text-sm text-foreground truncate">
                                    {m.name}
                                  </div>
                                  <div className="text-xs text-muted mt-0.5 font-medium">
                                    {formatCurrency(m.amount)}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                  <StatusBadge
                                    status={
                                      m.status as
                                        | "pending"
                                        | "delivered"
                                        | "approved"
                                        | "rejected"
                                        | "disputed"
                                    }
                                  />
                                </div>
                              </div>

                              {/* Who needs to act */}
                              {actionInfo.text && !isApproved && (
                                <div
                                  className={`mt-2 text-xs font-medium px-2 py-1 rounded-md inline-block ${
                                    actionInfo.highlight === userRole
                                      ? "bg-accent/10 text-accent border border-accent/20"
                                      : "text-muted"
                                  }`}
                                >
                                  {actionInfo.highlight === userRole
                                    ? "Your turn: "
                                    : ""}
                                  {actionInfo.text}
                                </div>
                              )}

                              {/* Proof hash */}
                              {m.proofHash && (
                                <div className="mt-3 pt-3 border-t border-border/50">
                                  <p className="text-xs text-muted font-medium">
                                    Proof:{" "}
                                    <code className="font-mono text-accent">
                                      {truncateMiddle(m.proofHash, 8, 6)}
                                    </code>
                                  </p>
                                </div>
                              )}

                              {/* Timeline events */}
                              {timeline.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap gap-3">
                                  {timeline.map((ev) => (
                                    <span
                                      key={ev.label}
                                      className="text-xs text-muted"
                                    >
                                      {ev.label}
                                      {ev.date && (
                                        <span className="ml-1 font-mono text-foreground/60">
                                          {new Date(ev.date).toLocaleDateString()}
                                        </span>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* ── Role-based actions ─────────────────────────── */}

                              {/* AGENCY actions */}
                              {userRole === "agency" && (
                                <>
                                  {isPending && (
                                    <div className="mt-4 pt-4 border-t border-border/50">
                                      <Link
                                        href={`/contracts/${id}/deliver`}
                                        className="inline-flex items-center gap-2 text-sm font-semibold text-accent border border-accent/30 rounded-lg px-4 py-2 hover:bg-accent/5 active:scale-[0.98] transition-all"
                                      >
                                        <Upload className="h-3.5 w-3.5" /> Submit
                                        Deliverable
                                      </Link>
                                    </div>
                                  )}
                                  {isDelivered && (
                                    <div className="mt-4 pt-4 border-t border-border/50">
                                      <p className="text-xs text-muted italic">
                                        Awaiting client review
                                      </p>
                                    </div>
                                  )}
                                  {isRejected && (
                                    <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t border-border/50">
                                      <Link
                                        href={`/contracts/${id}/dispute?milestone=${m.id}`}
                                        className="flex-1 inline-flex items-center justify-center h-9 px-4 rounded-lg bg-danger/10 text-danger text-sm font-semibold border border-danger/30 hover:bg-danger/15 active:scale-[0.98] transition-all"
                                      >
                                        <ShieldAlert className="h-4 w-4 mr-2" />
                                        Start Dispute
                                      </Link>
                                      <Link
                                        href={`/contracts/${id}/deliver`}
                                        className="flex-1 inline-flex items-center justify-center h-9 px-4 rounded-lg border border-border text-muted text-sm font-semibold hover:text-foreground hover:border-accent/50 active:scale-[0.98] transition-all"
                                      >
                                        Accept Rejection
                                      </Link>
                                    </div>
                                  )}
                                  {isDisputed && (
                                    <div className="mt-4 pt-4 border-t border-border/50">
                                      <Link
                                        href={`/contracts/${id}/dispute`}
                                        className="inline-flex items-center gap-2 text-sm font-semibold text-danger hover:underline"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        View Dispute
                                      </Link>
                                    </div>
                                  )}
                                </>
                              )}

                              {/* CLIENT actions */}
                              {userRole === "client" && (
                                <>
                                  {isPending && (
                                    <div className="mt-4 pt-4 border-t border-border/50">
                                      <p className="text-xs text-muted italic">
                                        Waiting for agency to deliver
                                      </p>
                                    </div>
                                  )}
                                  {isDelivered && (
                                    <>
                                      <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t border-border/50">
                                        <Button
                                          onPress={() => handleApprove(m.id)}
                                          isDisabled={approvingId === m.id}
                                          className="flex-1 bg-success text-success-foreground text-sm font-semibold rounded-lg shadow-sm shadow-success/20 active:scale-[0.98]"
                                        >
                                          {approvingId === m.id ? (
                                            <>
                                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                              Approving...
                                            </>
                                          ) : (
                                            <>
                                              <CheckCircle className="h-4 w-4 mr-2" />
                                              Approve
                                            </>
                                          )}
                                        </Button>
                                        <Button
                                          onPress={() => {
                                            setShowRejectForm(
                                              showRejectForm === m.id
                                                ? null
                                                : m.id,
                                            );
                                            setRejectReason("");
                                          }}
                                          className="flex-1 bg-danger/10 text-danger text-sm font-semibold rounded-lg border border-danger/30 hover:bg-danger/15 active:scale-[0.98]"
                                          variant="ghost"
                                        >
                                          <XCircle className="h-4 w-4 mr-2" />
                                          Reject
                                        </Button>
                                      </div>

                                      {/* Reject form (inline) */}
                                      <AnimatePresence>
                                        {showRejectForm === m.id && (
                                          <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="overflow-hidden"
                                          >
                                            <div className="mt-3 p-3 rounded-lg border border-danger/20 bg-danger/5 space-y-3">
                                              <label className="text-xs font-semibold text-danger">
                                                Rejection Reason
                                              </label>
                                              <TextArea
                                                value={rejectReason}
                                                onChange={(
                                                  e: React.ChangeEvent<HTMLTextAreaElement>,
                                                ) =>
                                                  setRejectReason(e.target.value)
                                                }
                                                placeholder="Explain why this deliverable does not meet requirements..."
                                                className="w-full resize-none text-sm"
                                              />
                                              <div className="flex gap-2">
                                                <Button
                                                  onPress={() =>
                                                    handleReject(m.id)
                                                  }
                                                  isDisabled={
                                                    rejectingId === m.id ||
                                                    !rejectReason.trim()
                                                  }
                                                  className="bg-danger text-danger-foreground text-sm font-semibold rounded-lg px-4"
                                                  size="sm"
                                                >
                                                  {rejectingId === m.id ? (
                                                    <>
                                                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                                      Rejecting...
                                                    </>
                                                  ) : (
                                                    "Confirm Rejection"
                                                  )}
                                                </Button>
                                                <Button
                                                  onPress={() => {
                                                    setShowRejectForm(null);
                                                    setRejectReason("");
                                                  }}
                                                  variant="ghost"
                                                  className="text-sm text-muted"
                                                  size="sm"
                                                >
                                                  Cancel
                                                </Button>
                                              </div>
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </>
                                  )}
                                  {isRejected && (
                                    <div className="mt-4 pt-4 border-t border-border/50">
                                      <p className="text-xs text-muted italic">
                                        Awaiting agency response
                                      </p>
                                    </div>
                                  )}
                                  {isDisputed && (
                                    <div className="mt-4 pt-4 border-t border-border/50">
                                      <Link
                                        href={`/contracts/${id}/dispute`}
                                        className="inline-flex items-center gap-2 text-sm font-semibold text-danger hover:underline"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        View Dispute
                                      </Link>
                                    </div>
                                  )}
                                </>
                              )}

                              {/* INVESTOR sees read-only dispute indicator */}
                              {userRole === "investor" && isDisputed && (
                                <div className="mt-4 pt-4 border-t border-border/50">
                                  <span className="inline-flex items-center gap-1.5 text-xs text-danger font-medium">
                                    <ShieldAlert className="h-3.5 w-3.5" />
                                    Dispute in progress
                                  </span>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Sidebar ───────────────────────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Quick actions — only for agency/client */}
            {(userRole === "agency" || userRole === "client") && (
              <Card className="border border-border bg-surface rounded-xl shadow-sm sticky top-6">
                <CardHeader className="px-5 pt-5 pb-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted">
                    Quick Actions
                  </p>
                </CardHeader>
                <CardContent className="px-5 pb-5 flex flex-col gap-2">
                  {userRole === "client" && deposited < contract.totalValue && (
                    <Link
                      href={`/contracts/${id}/deposit`}
                      className="flex items-center justify-center h-9 rounded-lg bg-accent text-accent-foreground text-sm font-semibold shadow-sm shadow-accent/20 hover:opacity-90 active:scale-[0.98] transition-all"
                    >
                      Deposit Escrow
                    </Link>
                  )}
                  {userRole === "agency" && (
                    <Link
                      href={`/contracts/${id}/deliver`}
                      className="flex items-center justify-center h-9 rounded-lg bg-accent text-accent-foreground text-sm font-semibold shadow-sm shadow-accent/20 hover:opacity-90 active:scale-[0.98] transition-all"
                    >
                      Submit Deliverable
                    </Link>
                  )}
                  {userRole === "agency" && contract.status === "active" && !isTokenized && (
                    <Link
                      href={`/contracts/${id}/tokenize`}
                      className="flex items-center justify-center h-9 rounded-lg bg-brand/10 text-brand text-sm font-semibold hover:bg-brand/20 active:scale-[0.98] transition-all"
                    >
                      Tokenize Contract
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Token info — only show after explicit tokenization (not just factory deployment) */}
            {isTokenized && contract.tokenAddress && (
              <Card className="border border-brand/30 bg-brand/5 rounded-xl shadow-sm">
                <CardHeader className="px-5 pt-5 pb-2 flex items-center gap-2">
                  <Coins className="h-4 w-4 text-brand" />
                  <p className="text-sm font-bold">Tokenized Asset</p>
                </CardHeader>
                <CardContent className="px-5 pb-5 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted font-medium">Token</span>
                    <span className="font-mono text-xs text-accent flex items-center gap-1 cursor-pointer hover:underline">
                      {truncateMiddle(contract.tokenAddress, 6, 4)}{" "}
                      <ExternalLink className="h-3 w-3" />
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted font-medium">Network</span>
                    <span className="font-semibold text-foreground">
                      Arbitrum
                    </span>
                  </div>
                  <Link
                    href={`/marketplace/${id}`}
                    className="flex items-center justify-center h-8 rounded-md bg-surface-secondary text-accent text-xs font-semibold border border-border/60 hover:bg-default active:scale-[0.98] transition-all"
                  >
                    View on Marketplace
                  </Link>
                  {userRole === "investor" && (
                    <Link
                      href={`/marketplace/${id}`}
                      className="flex items-center justify-center h-8 rounded-md bg-brand text-brand-foreground text-xs font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
                    >
                      Buy Tokens on Marketplace
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Blockchain activity — only for agency/client */}
            {(userRole === "agency" || userRole === "client") && blockchainEvents.length > 0 && (
              <Card className="border border-border rounded-xl shadow-sm">
                <CardHeader className="px-5 pt-5 pb-2 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-accent" />
                  <p className="text-sm font-bold">On-Chain Activity</p>
                </CardHeader>
                <CardContent className="px-5 pb-5 space-y-2">
                  {blockchainEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="flex items-center justify-between text-xs py-1.5 border-b border-border/40 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            evt.status === "confirmed"
                              ? "bg-success"
                              : evt.status === "failed"
                                ? "bg-danger"
                                : "bg-warning"
                          }`}
                        />
                        <span className="text-muted capitalize">
                          {evt.operation.replace(/_/g, " ")}
                        </span>
                      </div>
                      {evt.txHash ? (
                        <a
                          href={`https://sepolia.arbiscan.io/tx/${evt.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-accent hover:underline flex items-center gap-1"
                        >
                          {evt.txHash.slice(0, 6)}...{evt.txHash.slice(-4)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className={evt.status === "failed" ? "text-danger" : "text-muted"}>
                          {evt.status === "failed" ? "failed" : "pending"}
                        </span>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Role indicator */}
            <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-surface-secondary text-xs text-muted">
              {userRole === "agency" && (
                <>
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>You are the agency delivering this contract.</p>
                </>
              )}
              {userRole === "client" && (
                <>
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>You are the client. Only you and the agency can see contract details.</p>
                </>
              )}
              {userRole === "investor" && (
                <>
                  <Eye className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>You are viewing as an investor. Some details may be hidden by the agency.</p>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="col-span-full">
          <Card className="border border-border rounded-xl p-8 text-center">
            <Eye className="h-12 w-12 mx-auto text-muted mb-4" />
            <h3 className="text-lg font-bold mb-2">Contract Preview</h3>
            <p className="text-muted text-sm mb-1">
              {contract.milestones.filter(m => m.status === "approved").length}/{contract.milestones.length} milestones completed
            </p>
            <p className="text-muted text-sm mb-6">Total value: {formatCurrency(contract.totalValue)}</p>
            <Button onPress={() => login()} className="bg-accent text-accent-foreground">
              Sign in to view full details
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}

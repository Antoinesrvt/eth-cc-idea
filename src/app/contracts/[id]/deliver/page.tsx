"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Upload, Link2, FileText, ShieldCheck, Loader2, CheckCircle, Clock } from "lucide-react";
import { useContract, submitDeliverable } from "@/hooks/use-contracts";
import { useAuth } from "@/hooks/use-auth";
import { Button, Input, TextArea } from "@heroui/react";
import { PageHeader, SectionCard, StatusBadge } from "@/components/ui";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils/format";

export default function DeliverPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { contract, loading: contractLoading } = useContract(id);
  const { getAuthToken, walletAddress } = useAuth();

  const [selectedMilestoneId, setSelectedMilestoneId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [links, setLinks] = useState(["", ""]);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

  const addFiles = (newFiles: File[]) => {
    const oversized = newFiles.filter((f) => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      toast.error(`Files over 10 MB: ${oversized.map((f) => f.name).join(", ")}`);
      newFiles = newFiles.filter((f) => f.size <= MAX_FILE_SIZE);
    }
    if (newFiles.length > 0) {
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  // Milestones available for delivery (pending or delivered)
  const deliverableMilestones = contract?.milestones.filter(
    (m) => m.status === "pending" || m.status === "delivered",
  ) ?? [];

  // Pending milestones — selectable
  const pendingMilestones = deliverableMilestones.filter((m) => m.status === "pending");

  // Auto-select first pending milestone
  const activeMilestoneId = selectedMilestoneId ?? pendingMilestones[0]?.id ?? null;

  const handleSubmit = async () => {
    if (!activeMilestoneId) return;
    setSubmitting(true);
    setError(null);
    try {
      const proofHash = `proof_${Date.now().toString(36)}_${activeMilestoneId}`;
      const token = await getAuthToken();
      await submitDeliverable(id, {
        milestoneId: activeMilestoneId,
        proofHash,
        description: notes || undefined,
        links: links.filter(Boolean),
        files: files.length > 0 ? files : undefined,
      }, token, walletAddress);
      toast.success("Deliverable submitted");
      router.push(`/contracts/${id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submission failed";
      setError(msg);
      toast.error(msg);
      setSubmitting(false);
    }
  };

  // ── Empty state: no pending milestones ───────────────────────────────────
  if (!contractLoading && pendingMilestones.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PageHeader
          title="Submit Deliverable"
          description="Upload proof of work for milestone review"
          backHref={`/contracts/${id}`}
          backLabel="Back to Contract"
        />
        <div className="rounded-xl border border-border bg-surface-secondary p-8 text-center">
          <CheckCircle className="h-12 w-12 text-success mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">All milestones have been submitted</p>
          <p className="text-xs text-muted mb-4">Waiting for client review. You'll be notified when a milestone is approved or rejected.</p>
          <Link
            href={`/contracts/${id}`}
            className="text-sm text-accent hover:underline"
          >
            ← Back to Contract
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <PageHeader
        title="Submit Deliverable"
        description="Upload proof of work for milestone review"
        backHref={`/contracts/${id}`}
        backLabel="Back to Contract"
      />

      {/* Milestone Selection */}
      <SectionCard title="Select Milestone" className="mb-6">
        {contractLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted py-3">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading milestones...
          </div>
        ) : (
          <div className="space-y-2">
            {deliverableMilestones.map((m) => {
              const isPending = m.status === "pending";
              const isSelected = activeMilestoneId === m.id;

              return (
                <button
                  key={m.id}
                  onClick={() => isPending && setSelectedMilestoneId(m.id)}
                  disabled={!isPending}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    !isPending
                      ? "border-border bg-surface-secondary opacity-50 cursor-not-allowed"
                      : isSelected
                        ? "border-accent bg-accent/5 ring-1 ring-accent/30"
                        : "border-border bg-surface hover:border-accent/50 cursor-pointer"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`h-4 w-4 rounded-full border-2 flex-shrink-0 ${
                          isSelected && isPending ? "border-accent bg-accent" : "border-border"
                        }`} />
                        <span className="text-sm font-medium text-foreground truncate">{m.name}</span>
                      </div>
                      <div className="flex items-center gap-3 pl-6 text-xs text-muted flex-wrap">
                        <span className="font-semibold text-foreground">{formatCurrency(m.amount)}</span>
                        {m.deadline && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(m.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={m.status as "pending" | "delivered" | "approved" | "rejected"} />
                  </div>
                  {!isPending && (
                    <p className="text-xs text-muted mt-2 pl-6">
                      Already submitted — waiting for review
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Proof of Delivery */}
      <SectionCard title="Proof of Delivery" icon={<FileText className="h-5 w-5 text-accent" />} className="mb-6">
        <div className="space-y-6">
          {/* Description — moved up for prominence */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Description
            </label>
            <TextArea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe what you delivered, include relevant details — what was built, how it meets requirements, any deviations explained..."
              className="w-full resize-none"
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="text-sm font-medium mb-2 block">Upload Files</label>
            <label
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-accent/50 transition-colors block"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                addFiles(Array.from(e.dataTransfer.files));
              }}
            >
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
              <Upload className="h-8 w-8 mx-auto text-muted mb-2" />
              <p className="text-sm text-muted">Drop files here or click to upload</p>
              <p className="text-xs text-muted mt-1">Screenshots, documents, code exports (max 50MB)</p>
            </label>
            {files.length > 0 && (
              <div className="mt-3 space-y-1">
                {files.map((f, i) => (
                  <div key={`file-${i}`} className="flex items-center justify-between text-sm bg-surface-secondary rounded-lg px-3 py-2">
                    <span className="flex items-center gap-2 truncate">
                      <FileText className="h-4 w-4 text-muted shrink-0" />
                      <span className="truncate">{f.name}</span>
                      <span className="text-xs text-muted shrink-0">({(f.size / 1024).toFixed(0)} KB)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="text-muted hover:text-danger ml-2 shrink-0"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Links */}
          <div>
            <label className="text-sm font-medium mb-2 block flex items-center gap-2">
              <Link2 className="h-4 w-4" /> Links
            </label>
            <div className="space-y-2">
              {links.map((link, i) => (
                <Input
                  key={`link-${i}`}
                  type="url"
                  value={link}
                  onChange={(e) => {
                    const updated = [...links];
                    updated[i] = e.target.value;
                    setLinks(updated);
                  }}
                  placeholder={i === 0 ? "https://github.com/org/repo/pull/42" : "https://staging.example.com"}
                  className="w-full"
                />
              ))}
              <Button
                variant="ghost"
                onPress={() => setLinks([...links, ""])}
                className="text-sm text-accent hover:underline"
              >
                + Add link
              </Button>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Submission Note */}
      <SectionCard
        title="What Happens Next"
        icon={<ShieldCheck className="h-5 w-5 text-accent" />}
        className="border-accent/30 bg-accent/5 mb-6"
      >
        <p className="text-sm text-muted">
          Once submitted, the client will review your deliverables and approve or reject the milestone. Approved milestones release escrow to the agency and any investors.
        </p>
      </SectionCard>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-danger/10 border border-danger/20">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <Button
        onPress={handleSubmit}
        isDisabled={submitting || !activeMilestoneId || !notes.trim()}
        fullWidth
        className="py-4 rounded-xl bg-accent text-foreground font-medium text-lg hover:bg-accent/80 transition-colors"
      >
        {submitting && <Loader2 className="h-5 w-5 animate-spin mr-2" />}
        {submitting ? "Submitting..." : "Submit Deliverable"}
      </Button>

      <p className="text-xs text-muted text-center mt-3">
        Files will be uploaded to IPFS. Proof hash recorded on Arbitrum.
      </p>
    </div>
  );
}

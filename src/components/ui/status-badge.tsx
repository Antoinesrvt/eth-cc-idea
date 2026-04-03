"use client";
import { Chip } from "@heroui/react";

type Color = "default" | "success" | "warning" | "danger" | "accent";

type StatusConfigEntry = { color: Color; label: string };

const statusConfig: Record<string, StatusConfigEntry> = {
  // Contract statuses
  draft: { color: "default", label: "Draft" },
  invited: { color: "default", label: "Invited" },
  pending_deposit: { color: "warning", label: "Awaiting Deposit" },
  active: { color: "success", label: "Active" },
  completed: { color: "success", label: "Completed" },
  disputed: { color: "danger", label: "Disputed" },
  cancelled: { color: "default", label: "Cancelled" },
  failed: { color: "danger", label: "Failed" },

  // Milestone statuses
  pending: { color: "default", label: "Pending" },
  delivered: { color: "warning", label: "Delivered" },
  approved: { color: "success", label: "Approved" },
  rejected: { color: "danger", label: "Rejected" },

  // Dispute phases
  evidence: { color: "warning", label: "Evidence" },
  kleros_payment: { color: "warning", label: "Fee Required" },
  kleros_review: { color: "accent", label: "Court Review" },
  resolved: { color: "success", label: "Resolved" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? { color: "default" as Color, label: status };
  return (
    <Chip size="sm" color={config.color} variant="soft" className="capitalize">
      {config.label}
    </Chip>
  );
}

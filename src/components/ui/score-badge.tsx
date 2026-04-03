"use client";
import { Chip } from "@heroui/react";
import { Bot } from "lucide-react";

export function ScoreBadge({ score, showIcon = true }: { score: number; showIcon?: boolean }) {
  const color: "success" | "warning" | "danger" = score >= 80 ? "success" : score >= 50 ? "warning" : "danger";
  return (
    <Chip
      size="sm"
      color={color}
      variant="soft"
    >
      {showIcon && <Bot className="h-3 w-3 mr-1 inline-block" />}
      {score}
    </Chip>
  );
}

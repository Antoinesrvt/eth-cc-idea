"use client";
import { ProgressBar, ProgressBarTrack, ProgressBarFill } from "@heroui/react";

export function LabeledProgress({ label, value, color, showValue = true }: {
  label?: string;
  value: number;
  color?: "default" | "success" | "warning" | "danger" | "accent";
  showValue?: boolean;
}) {
  return (
    <div>
      {(label || showValue) && (
        <div className="flex justify-between text-xs text-muted mb-1.5">
          {label && <span>{label}</span>}
          {showValue && <span>{Math.round(value)}%</span>}
        </div>
      )}
      <ProgressBar value={value} color={color || "default"} size="sm" aria-label={label || "Progress"}>
        <ProgressBarTrack>
          <ProgressBarFill />
        </ProgressBarTrack>
      </ProgressBar>
    </div>
  );
}

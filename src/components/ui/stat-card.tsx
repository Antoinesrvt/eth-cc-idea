import { Card, CardContent } from "@heroui/react";
import type { ReactNode } from "react";

export function StatCard({ value, label, icon, color }: {
  value: string | number;
  label: string;
  icon?: ReactNode;
  color?: "success" | "danger" | "warning" | "accent";
}) {
  const colorClasses: Record<string, string> = {
    success: "text-success",
    danger: "text-danger",
    warning: "text-warning",
    accent: "text-accent",
  };
  const colorClass = color ? colorClasses[color] : "";
  return (
    <Card className="border border-border">
      <CardContent className="p-4 text-center">
        {icon && <div className="mb-2 flex justify-center">{icon}</div>}
        <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
        <div className="text-xs text-muted mt-0.5">{label}</div>
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader } from "@heroui/react";
import type { ReactNode } from "react";

export function SectionCard({ title, icon, children, className, action }: {
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <Card className={`border border-border ${className || ""}`}>
      {title && (
        <CardHeader className="flex flex-row items-center justify-between px-6 pt-5 pb-0">
          <h3 className="text-base font-semibold flex items-center gap-2">
            {icon}{title}
          </h3>
          {action}
        </CardHeader>
      )}
      <CardContent className="p-6 pt-4">{children}</CardContent>
    </Card>
  );
}

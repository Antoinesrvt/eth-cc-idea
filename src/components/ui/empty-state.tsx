import { ReactNode } from "react";

export function EmptyState({ icon, title, description, action }: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-4 text-muted">{icon}</div>}
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      {description && <p className="text-sm text-muted mb-4 max-w-md">{description}</p>}
      {action}
    </div>
  );
}

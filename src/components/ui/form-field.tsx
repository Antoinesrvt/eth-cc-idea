import type { ReactNode } from "react";

export function FormField({ label, required, hint, children, error }: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  error?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium mb-2 block">
        {label}
        {required && <span className="text-danger ml-1">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted mt-1.5">{hint}</p>}
      {error && <p className="text-xs text-danger mt-1.5">{error}</p>}
    </div>
  );
}

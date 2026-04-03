import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function PageHeader({ title, description, backHref, backLabel }: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mb-8">
      {backHref && (
        <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" /> {backLabel || "Back"}
        </Link>
      )}
      <h1 className="text-3xl font-bold mb-1">{title}</h1>
      {description && <p className="text-muted">{description}</p>}
    </div>
  );
}

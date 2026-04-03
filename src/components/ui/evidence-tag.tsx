import { Chip } from "@heroui/react";

interface EvidenceTagProps {
  type: string;
}

export function EvidenceTag({ type }: EvidenceTagProps) {
  const colorMap: Record<string, "default" | "success" | "warning" | "danger"> = {
    argument: "default",
    document: "default",
    testimony: "warning",
    ruling: "success",
  };

  const color = colorMap[type] ?? "default";

  return (
    <Chip size="sm" variant="soft" color={color} className="capitalize">
      {type}
    </Chip>
  );
}

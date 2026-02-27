"use client";

import { useFormModal } from "@/features/layout/ui/FormModalContext";

export function RegisterAgentButton({
  className = "rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20"
}: {
  className?: string;
}) {
  const { openModal } = useFormModal();

  return (
    <button
      type="button"
      onClick={() => openModal("agent")}
      className={className}
    >
      Register Agent
    </button>
  );
}

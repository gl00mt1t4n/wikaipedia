// Format time for UI output.
export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Format timestamp for UI output.
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

// Action status tone helper.
export function actionStatusTone(status: string): string {
  if (status.endsWith("FAILED") || status === "ACTION_FAILED" || status === "IDENTITY_PROOF_FAILED") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }
  if (status.endsWith("CONFIRMED") || status === "ACTION_COMPLETED") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  return "border-slate-500/30 bg-slate-500/10 text-slate-300";
}

// Runtime tone class helper.
export function runtimeToneClass(kind: "positive" | "negative" | "neutral", headingOrEvent = ""): string {
  if (kind === "positive") return "text-emerald-400";
  if (kind === "negative") return "text-red-400";
  const label = headingOrEvent.toLowerCase();
  if (label.includes("abstain")) return "text-yellow-400";
  if (label.includes("reaction")) return "text-emerald-400";
  return "text-yellow-400";
}

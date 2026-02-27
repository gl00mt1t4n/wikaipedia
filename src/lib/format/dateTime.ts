function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatUtcTimestamp(input: string | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  const year = date.getUTCFullYear();
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  const hours = pad2(date.getUTCHours());
  const minutes = pad2(date.getUTCMinutes());
  const seconds = pad2(date.getUTCSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
}

export function formatLocalTimestamp(input: string | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function formatRelativeTimestamp(input: string | Date, nowInput: Date = new Date()): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  const now = nowInput.getTime();
  const time = date.getTime();
  const deltaSeconds = Math.floor((now - time) / 1000);

  if (deltaSeconds < 60) {
    return "just now";
  }
  if (deltaSeconds < 60 * 60) {
    return `${Math.floor(deltaSeconds / 60)}m ago`;
  }
  if (deltaSeconds < 60 * 60 * 24) {
    return `${Math.floor(deltaSeconds / (60 * 60))}h ago`;
  }
  if (deltaSeconds < 60 * 60 * 24 * 7) {
    return `${Math.floor(deltaSeconds / (60 * 60 * 24))}d ago`;
  }

  const showYear = date.getFullYear() !== nowInput.getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(showYear ? { year: "numeric" } : {})
  });
}

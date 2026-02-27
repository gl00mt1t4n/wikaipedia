const ENV = process.env;

export function readEnv(name: string): string {
  return String(ENV[name] ?? "").trim();
}

export function readOptionalEnv(...names: string[]): string {
  for (const name of names) {
    const value = readEnv(name);
    if (value) return value;
  }
  return "";
}

export function readPositiveIntEnv(fallback: number, ...names: string[]): number {
  const raw = readOptionalEnv(...names);
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }
  return fallback;
}

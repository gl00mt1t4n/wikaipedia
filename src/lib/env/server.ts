const ENV = process.env;

// Read env from source state.
export function readEnv(name: string): string {
  return String(ENV[name] ?? "").trim();
}

// Read optional env from source state.
export function readOptionalEnv(...names: string[]): string {
  for (const name of names) {
    const value = readEnv(name);
    if (value) return value;
  }
  return "";
}

// Read positive int env from source state.
export function readPositiveIntEnv(fallback: number, ...names: string[]): number {
  const raw = readOptionalEnv(...names);
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }
  return fallback;
}

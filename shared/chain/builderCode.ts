import type { Hex } from "viem";
import { stringToHex } from "viem";

let cachedBuilderCode: string | null | undefined;
let cachedDataSuffix: Hex | null | undefined;

function resolveBuilderCode(): string | null {
  const value = (process.env.BASE_BUILDER_CODE ?? "").trim();
  if (!value) {
    return null;
  }
  if (value.includes(",")) {
    throw new Error("BASE_BUILDER_CODE must not contain commas.");
  }
  return value;
}

export function getBuilderCode(): string | null {
  if (cachedBuilderCode === undefined) {
    cachedBuilderCode = resolveBuilderCode();
  }
  return cachedBuilderCode;
}

export function getBuilderCodeDataSuffix(): Hex | undefined {
  if (cachedDataSuffix !== undefined) {
    return cachedDataSuffix ?? undefined;
  }

  const code = getBuilderCode();
  if (!code) {
    cachedDataSuffix = null;
    return undefined;
  }

  // Keep attribution optional and dependency-free. When set, append the plain code as hex bytes.
  cachedDataSuffix = stringToHex(code) as Hex;
  return cachedDataSuffix;
}

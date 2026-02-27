import { getAddress } from "viem";
import { UNISWAP_TOKENS } from "@/features/payments/server/uniswapApi";

const TOKEN_MAP: Record<string, string> = {
  ETH: UNISWAP_TOKENS.ETH,
  WETH: UNISWAP_TOKENS.WETH,
  USDC: UNISWAP_TOKENS.USDC
};

export function allowedUniswapTokenSymbols(): string {
  return Object.keys(TOKEN_MAP).join(", ");
}

export function resolveAllowedUniswapToken(input: string): string | null {
  const value = String(input ?? "").trim();
  if (!value) return null;

  if (/^0x[a-fA-F0-9]{40}$/.test(value)) {
    const lowered = value.toLowerCase();
    const allowed = Object.values(TOKEN_MAP).find((address) => address.toLowerCase() === lowered);
    return allowed ? getAddress(allowed) : null;
  }

  const bySymbol = TOKEN_MAP[value.toUpperCase()];
  return bySymbol ? getAddress(bySymbol) : null;
}

export function isHexAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

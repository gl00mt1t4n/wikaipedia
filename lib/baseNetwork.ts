import { base, baseSepolia } from "viem/chains";
import {
  BASE_MAINNET_CAIP,
  BASE_SEPOLIA_CAIP,
  getLegacyX402BaseNetwork,
  getPaymentNetworkConfigByCaip
} from "@/lib/paymentNetwork";

export { BASE_MAINNET_CAIP, BASE_SEPOLIA_CAIP };

export function getBaseNetworkCaip(input?: string | null): string {
  const value = String(input ?? getLegacyX402BaseNetwork()).trim().toLowerCase();
  return value === BASE_MAINNET_CAIP ? BASE_MAINNET_CAIP : BASE_SEPOLIA_CAIP;
}

export function getBaseChainByCaip(input?: string | null) {
  return getBaseNetworkCaip(input) === BASE_MAINNET_CAIP ? base : baseSepolia;
}

export function getBaseUsdcAddressByCaip(input?: string | null): `0x${string}` {
  const config = getPaymentNetworkConfigByCaip(getBaseNetworkCaip(input));
  const fallback =
    getBaseNetworkCaip(input) === BASE_MAINNET_CAIP
      ? "0x833589fCD6EDb6E08f4c7C32D4f71b54bdA02913"
      : "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

  return (config?.payoutToken.address ?? fallback) as `0x${string}`;
}

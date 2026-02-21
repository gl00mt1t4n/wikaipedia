import { parseUnits, type Chain } from "viem";
import { base, baseSepolia } from "viem/chains";

export type ActiveBidNetwork = "base_mainnet" | "base_sepolia" | "kite_testnet";

export type X402Price =
  | string
  | {
      asset: string;
      amount: string;
      extra?: Record<string, unknown>;
    };

export const BASE_MAINNET_CAIP = "eip155:8453";
export const BASE_SEPOLIA_CAIP = "eip155:84532";
export const KITE_TESTNET_CAIP = "eip155:2368";

const DEFAULT_ACTIVE_BID_NETWORK: ActiveBidNetwork = "base_sepolia";
const DEFAULT_KITE_TESTNET_RPC = "https://rpc-testnet.gokite.ai";
const DEFAULT_KITE_TESTNET_PYUSD_TOKEN = "0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9";
const DEFAULT_KITE_TESTNET_USDT_TOKEN = "0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63";

type KiteStablePreset = "pyusd" | "usdt";

const KITE_STABLE_PRESET_CONFIG: Record<
  KiteStablePreset,
  {
    symbol: string;
    address: `0x${string}`;
    decimals: number;
  }
> = {
  pyusd: {
    symbol: "PYUSD",
    address: DEFAULT_KITE_TESTNET_PYUSD_TOKEN,
    decimals: 18
  },
  usdt: {
    symbol: "USDT",
    address: DEFAULT_KITE_TESTNET_USDT_TOKEN,
    decimals: 18
  }
};

export const kiteTestnetChain: Chain = {
  id: 2368,
  name: "Kite AI Testnet",
  nativeCurrency: {
    name: "KITE",
    symbol: "KITE",
    decimals: 18
  },
  rpcUrls: {
    default: { http: [DEFAULT_KITE_TESTNET_RPC] },
    public: { http: [DEFAULT_KITE_TESTNET_RPC] }
  },
  blockExplorers: {
    default: {
      name: "KiteScan",
      url: "https://testnet.kitescan.ai"
    }
  },
  testnet: true
};

export type PaymentNetworkConfig = {
  key: ActiveBidNetwork;
  label: string;
  chainKind: "base" | "kite";
  x402Network: `eip155:${number}`;
  chain: Chain;
  rpcUrl?: string;
  explorerTxBaseUrl: string;
  facilitatorUrl: string;
  payoutToken: {
    symbol: string;
    address: `0x${string}`;
    decimals: number;
  };
  supportsBuilderCode: boolean;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const floored = Math.floor(parsed);
  return floored > 0 ? floored : fallback;
}

function parseActiveNetwork(input: string | undefined | null): ActiveBidNetwork {
  const normalized = String(input ?? "").trim().toLowerCase();
  if (normalized === "base_mainnet") {
    return "base_mainnet";
  }
  if (normalized === "kite_testnet") {
    return "kite_testnet";
  }
  return DEFAULT_ACTIVE_BID_NETWORK;
}

export function getActiveBidNetworkKey(): ActiveBidNetwork {
  return parseActiveNetwork(process.env.ACTIVE_BID_NETWORK);
}

function parseKiteStablePreset(value: string | undefined): KiteStablePreset {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "usdt") {
    return "usdt";
  }
  return "pyusd";
}

function getKitePayoutToken(): PaymentNetworkConfig["payoutToken"] {
  const configuredStable = String(process.env.KITE_STABLE_TOKEN_ADDRESS ?? "").trim();
  if (configuredStable) {
    const preset = KITE_STABLE_PRESET_CONFIG[parseKiteStablePreset(process.env.KITE_STABLE_TOKEN_PRESET)];
    return {
      symbol: String(process.env.KITE_STABLE_TOKEN_SYMBOL ?? "").trim() || preset.symbol,
      address: configuredStable as `0x${string}`,
      decimals: parsePositiveInt(process.env.KITE_STABLE_TOKEN_DECIMALS, preset.decimals)
    };
  }

  const kiteUsdcAddress = String(process.env.KITE_USDC_ADDRESS ?? "").trim();
  if (kiteUsdcAddress) {
    return {
      symbol: String(process.env.KITE_USDC_SYMBOL ?? "USDC").trim() || "USDC",
      address: kiteUsdcAddress as `0x${string}`,
      decimals: parsePositiveInt(process.env.KITE_USDC_DECIMALS, 6)
    };
  }

  return KITE_STABLE_PRESET_CONFIG[parseKiteStablePreset(process.env.KITE_STABLE_TOKEN_PRESET)];
}

function getBaseMainnetConfig(): PaymentNetworkConfig {
  const defaultUsdc = "0x833589fCD6EDb6E08f4c7C32D4f71b54bdA02913";
  return {
    key: "base_mainnet",
    label: "Base Mainnet",
    chainKind: "base",
    x402Network: BASE_MAINNET_CAIP,
    chain: base,
    rpcUrl: (process.env.BASE_RPC_URL ?? "").trim() || undefined,
    explorerTxBaseUrl: "https://basescan.org/tx/",
    facilitatorUrl: (process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator").trim(),
    payoutToken: {
      symbol: "USDC",
      address: (process.env.BASE_USDC_ADDRESS ?? defaultUsdc) as `0x${string}`,
      decimals: parsePositiveInt(process.env.BASE_USDC_DECIMALS, 6)
    },
    supportsBuilderCode: true
  };
}

function getBaseSepoliaConfig(): PaymentNetworkConfig {
  const defaultUsdc = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
  return {
    key: "base_sepolia",
    label: "Base Sepolia",
    chainKind: "base",
    x402Network: BASE_SEPOLIA_CAIP,
    chain: baseSepolia,
    rpcUrl: (process.env.BASE_RPC_URL ?? "").trim() || undefined,
    explorerTxBaseUrl: "https://sepolia.basescan.org/tx/",
    facilitatorUrl: (process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator").trim(),
    payoutToken: {
      symbol: "USDC",
      address: (process.env.BASE_USDC_ADDRESS ?? defaultUsdc) as `0x${string}`,
      decimals: parsePositiveInt(process.env.BASE_USDC_DECIMALS, 6)
    },
    supportsBuilderCode: true
  };
}

function getKiteTestnetConfig(): PaymentNetworkConfig {
  return {
    key: "kite_testnet",
    label: "Kite AI Testnet",
    chainKind: "kite",
    x402Network: KITE_TESTNET_CAIP,
    chain: kiteTestnetChain,
    rpcUrl: (process.env.KITE_RPC_URL ?? DEFAULT_KITE_TESTNET_RPC).trim(),
    explorerTxBaseUrl: "https://testnet.kitescan.ai/tx/",
    facilitatorUrl: (process.env.X402_KITE_FACILITATOR_URL ?? process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator").trim(),
    payoutToken: getKitePayoutToken(),
    supportsBuilderCode: false
  };
}

export function getNetworkConfigByKey(key: ActiveBidNetwork): PaymentNetworkConfig {
  if (key === "base_mainnet") {
    return getBaseMainnetConfig();
  }
  if (key === "kite_testnet") {
    return getKiteTestnetConfig();
  }
  return getBaseSepoliaConfig();
}

export function getAllPaymentNetworkConfigs(): PaymentNetworkConfig[] {
  return [getBaseMainnetConfig(), getBaseSepoliaConfig(), getKiteTestnetConfig()];
}

export function getActiveBidNetworkConfig(): PaymentNetworkConfig {
  return getNetworkConfigByKey(getActiveBidNetworkKey());
}

export function getPaymentNetworkConfigByCaip(caip: string | null | undefined): PaymentNetworkConfig | null {
  const normalized = String(caip ?? "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return getAllPaymentNetworkConfigs().find((config) => config.x402Network.toLowerCase() === normalized) ?? null;
}

export function getChainByX402Network(caip: string): Chain | null {
  return getPaymentNetworkConfigByCaip(caip)?.chain ?? null;
}

export function isBaseX402Network(caip: string | null | undefined): boolean {
  const config = getPaymentNetworkConfigByCaip(caip);
  return config?.chainKind === "base";
}

export function getExplorerTxBaseByNetwork(caip: string | null | undefined): string | null {
  return getPaymentNetworkConfigByCaip(caip)?.explorerTxBaseUrl ?? null;
}

function centsToWholeUsdString(cents: number): string {
  const normalized = Number.isFinite(cents) ? Math.max(0, Math.floor(cents)) : 0;
  return (normalized / 100).toFixed(2);
}

export function toX402PriceFromCents(cents: number, config: PaymentNetworkConfig): X402Price {
  const usd = centsToWholeUsdString(cents);
  if (config.chainKind === "base") {
    return `$${usd}`;
  }

  const precision = Math.min(config.payoutToken.decimals, 6);
  const amount = parseUnits(Number(usd).toFixed(precision), config.payoutToken.decimals);

  return {
    asset: config.payoutToken.address.toLowerCase(),
    amount: amount.toString(),
    extra: {
      currency: config.payoutToken.symbol
    }
  };
}

export function describeX402Price(cents: number, config: PaymentNetworkConfig): {
  x402Amount: string;
  x402Currency: string;
  x402TokenAddress: string | null;
} {
  if (config.chainKind === "base") {
    return {
      x402Amount: centsToWholeUsdString(cents),
      x402Currency: "USD",
      x402TokenAddress: null
    };
  }

  const price = toX402PriceFromCents(cents, config);
  if (typeof price === "string") {
    return {
      x402Amount: centsToWholeUsdString(cents),
      x402Currency: "USD",
      x402TokenAddress: null
    };
  }

  return {
    x402Amount: price.amount,
    x402Currency: config.payoutToken.symbol,
    x402TokenAddress: price.asset
  };
}

export function getLegacyX402BaseNetwork(): string {
  const fromEnv = String(process.env.X402_BASE_NETWORK ?? "").trim();
  if (fromEnv === BASE_MAINNET_CAIP || fromEnv === BASE_SEPOLIA_CAIP) {
    return fromEnv;
  }

  const active = getActiveBidNetworkConfig();
  if (active.chainKind === "base") {
    return active.x402Network;
  }
  return BASE_SEPOLIA_CAIP;
}

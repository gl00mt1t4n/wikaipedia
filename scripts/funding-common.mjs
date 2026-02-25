import { base, baseSepolia } from "viem/chains";

export const DEFAULT_KITE_RPC_URL = "https://rpc-testnet.gokite.ai";
const DEFAULT_KITE_TESTNET_PYUSD_TOKEN = "0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9";
const DEFAULT_KITE_TESTNET_USDT_TOKEN = "0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63";

export const ERC20_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  }
];

export function fail(message) {
  console.error(message);
  process.exit(1);
}

export function isAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value ?? "").trim());
}

export function isNonceTooLowError(error) {
  const text = error instanceof Error ? error.message : String(error);
  return text.toLowerCase().includes("nonce too low");
}

function kiteRpcUrl() {
  return String(process.env.KITE_RPC_URL ?? DEFAULT_KITE_RPC_URL).trim();
}

function createKiteTestnetChain() {
  const rpcUrl = kiteRpcUrl();
  return {
    id: 2368,
    name: "Kite AI Testnet",
    nativeCurrency: { name: "KITE", symbol: "KITE", decimals: 18 },
    rpcUrls: {
      default: { http: [rpcUrl] },
      public: { http: [rpcUrl] }
    },
    blockExplorers: {
      default: { name: "KiteScan", url: "https://testnet.kitescan.ai" }
    },
    testnet: true
  };
}

function normalizeFallbackNetwork(value, fallback = "base_sepolia") {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "base_mainnet" || normalized === "base_sepolia" || normalized === "kite_testnet") {
    return normalized;
  }
  return fallback;
}

export function resolveActiveNetworkKey(defaultNetwork = "base_sepolia") {
  const active = String(process.env.ACTIVE_BID_NETWORK ?? "").trim().toLowerCase();
  if (active === "base_mainnet" || active === "base_sepolia" || active === "kite_testnet") {
    return active;
  }

  const legacy = String(process.env.X402_BASE_NETWORK ?? "").trim();
  if (legacy === "eip155:8453") {
    return "base_mainnet";
  }
  if (legacy === "eip155:84532") {
    return "base_sepolia";
  }

  return normalizeFallbackNetwork(defaultNetwork);
}

function parseKiteStablePreset(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "usdt" ? "usdt" : "pyusd";
}

function resolveKiteStablePresetForExact(warningPrefix) {
  const requested = parseKiteStablePreset(process.env.KITE_STABLE_TOKEN_PRESET);
  const allowUnsupported = String(process.env.KITE_ALLOW_UNSUPPORTED_EXACT_TOKEN ?? "").trim() === "1";
  if (requested !== "usdt" || allowUnsupported) {
    return requested;
  }
  console.warn(
    `[${warningPrefix}] KITE_STABLE_TOKEN_PRESET=usdt is not compatible with @x402/evm exact (EIP-3009). Funding PYUSD instead. Set KITE_ALLOW_UNSUPPORTED_EXACT_TOKEN=1 to bypass.`
  );
  return "pyusd";
}

function resolveKiteStableToken(warningPrefix) {
  const configuredAddress = String(process.env.KITE_STABLE_TOKEN_ADDRESS ?? "").trim();
  const preset = resolveKiteStablePresetForExact(warningPrefix);
  const presetDefaults =
    preset === "usdt"
      ? { symbol: "USDT", address: DEFAULT_KITE_TESTNET_USDT_TOKEN, decimals: 18 }
      : { symbol: "PYUSD", address: DEFAULT_KITE_TESTNET_PYUSD_TOKEN, decimals: 18 };

  if (configuredAddress) {
    return {
      tokenSymbol: String(process.env.KITE_STABLE_TOKEN_SYMBOL ?? "").trim() || presetDefaults.symbol,
      tokenAddress: configuredAddress,
      tokenDecimals: Number(process.env.KITE_STABLE_TOKEN_DECIMALS ?? presetDefaults.decimals)
    };
  }

  const kiteUsdcAddress = String(process.env.KITE_USDC_ADDRESS ?? "").trim();
  if (kiteUsdcAddress) {
    return {
      tokenSymbol: String(process.env.KITE_USDC_SYMBOL ?? "USDC").trim() || "USDC",
      tokenAddress: kiteUsdcAddress,
      tokenDecimals: Number(process.env.KITE_USDC_DECIMALS ?? 6)
    };
  }

  return {
    tokenSymbol: presetDefaults.symbol,
    tokenAddress: presetDefaults.address,
    tokenDecimals: presetDefaults.decimals
  };
}

export function getStableFundingNetworkConfig(options = {}) {
  const key = resolveActiveNetworkKey(options.defaultNetwork ?? "base_sepolia");
  const warningPrefix = String(options.warningPrefix ?? "funding").trim() || "funding";

  if (key === "base_mainnet") {
    return {
      key,
      label: "Base Mainnet",
      chain: base,
      rpcUrl: (process.env.BASE_RPC_URL ?? "").trim() || undefined,
      escrowPrivateKey: String(process.env.BASE_ESCROW_PRIVATE_KEY ?? "").trim(),
      tokenSymbol: "USDC",
      tokenAddress: String(process.env.BASE_USDC_ADDRESS ?? "0x833589fCD6EDb6E08f4c7C32D4f71b54bdA02913").trim(),
      tokenDecimals: Number(process.env.BASE_USDC_DECIMALS ?? 6),
      supportsBuilderCode: true
    };
  }

  if (key === "kite_testnet") {
    const stableToken = resolveKiteStableToken(warningPrefix);

    return {
      key,
      label: "Kite AI Testnet",
      chain: createKiteTestnetChain(),
      rpcUrl: kiteRpcUrl(),
      escrowPrivateKey: String(
        process.env.KITE_ESCROW_PRIVATE_KEY ?? process.env.BASE_ESCROW_PRIVATE_KEY ?? ""
      ).trim(),
      tokenSymbol: stableToken.tokenSymbol,
      tokenAddress: stableToken.tokenAddress,
      tokenDecimals: stableToken.tokenDecimals,
      supportsBuilderCode: false
    };
  }

  return {
    key: "base_sepolia",
    label: "Base Sepolia",
    chain: baseSepolia,
    rpcUrl: (process.env.BASE_RPC_URL ?? "").trim() || undefined,
    escrowPrivateKey: String(process.env.BASE_ESCROW_PRIVATE_KEY ?? "").trim(),
    tokenSymbol: "USDC",
    tokenAddress: String(process.env.BASE_USDC_ADDRESS ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e").trim(),
    tokenDecimals: Number(process.env.BASE_USDC_DECIMALS ?? 6),
    supportsBuilderCode: true
  };
}

export function getGasFundingNetworkConfig(options = {}) {
  const key = resolveActiveNetworkKey(options.defaultNetwork ?? "kite_testnet");

  if (key === "base_mainnet") {
    return {
      key,
      label: "Base Mainnet",
      chain: base,
      rpcUrl: (process.env.BASE_RPC_URL ?? "").trim() || undefined,
      explorerTxBase: "https://basescan.org/tx/"
    };
  }

  if (key === "base_sepolia") {
    return {
      key,
      label: "Base Sepolia",
      chain: baseSepolia,
      rpcUrl: (process.env.BASE_RPC_URL ?? "").trim() || undefined,
      explorerTxBase: "https://sepolia.basescan.org/tx/"
    };
  }

  return {
    key: "kite_testnet",
    label: "Kite AI Testnet",
    chain: createKiteTestnetChain(),
    rpcUrl: kiteRpcUrl(),
    explorerTxBase: "https://testnet.kitescan.ai/tx/"
  };
}

export async function createNonceManagedSender(input) {
  const { publicClient, walletClient, account, chain } = input;
  let nextNonce = await publicClient.getTransactionCount({
    address: account.address,
    blockTag: "pending"
  });

  return async function sendTxWithManagedNonce(txRequest) {
    while (true) {
      try {
        const hash = await walletClient.sendTransaction({
          ...txRequest,
          account,
          chain,
          nonce: nextNonce
        });
        nextNonce += 1;
        return hash;
      } catch (error) {
        if (!isNonceTooLowError(error)) {
          throw error;
        }
        nextNonce = await publicClient.getTransactionCount({
          address: account.address,
          blockTag: "pending"
        });
      }
    }
  };
}

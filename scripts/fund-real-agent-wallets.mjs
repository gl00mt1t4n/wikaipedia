import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatEther,
  formatUnits,
  http,
  parseEther,
  parseUnits
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import { loadLocalEnv } from "./load-local-env.mjs";
import { loadRealAgentsConfig } from "./real-agents-config.mjs";

loadLocalEnv();

const ERC20_ABI = [
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

const KITE_TESTNET_CHAIN = {
  id: 2368,
  name: "Kite AI Testnet",
  nativeCurrency: { name: "KITE", symbol: "KITE", decimals: 18 },
  rpcUrls: {
    default: { http: [String(process.env.KITE_RPC_URL ?? "https://rpc-testnet.gokite.ai").trim()] },
    public: { http: [String(process.env.KITE_RPC_URL ?? "https://rpc-testnet.gokite.ai").trim()] }
  },
  blockExplorers: {
    default: { name: "KiteScan", url: "https://testnet.kitescan.ai" }
  },
  testnet: true
};

const ACTIVE_BID_NETWORK = String(process.env.ACTIVE_BID_NETWORK ?? "").trim().toLowerCase();
const LEGACY_X402_NETWORK = String(process.env.X402_BASE_NETWORK ?? "").trim();
const ETH_PER_WALLET = process.argv[2] ? Number(process.argv[2]) : 0.03;
const STABLE_PER_WALLET = process.argv[3] ? Number(process.argv[3]) : 2;
const DEFAULT_KITE_TESTNET_PYUSD_TOKEN = "0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9";
const DEFAULT_KITE_TESTNET_USDT_TOKEN = "0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function resolveNetworkKey() {
  if (ACTIVE_BID_NETWORK === "base_mainnet" || ACTIVE_BID_NETWORK === "kite_testnet") {
    return ACTIVE_BID_NETWORK;
  }
  if (LEGACY_X402_NETWORK === "eip155:8453") {
    return "base_mainnet";
  }
  return "base_sepolia";
}

function parseKiteStablePreset(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "usdt" ? "usdt" : "pyusd";
}

function resolveKiteStableToken() {
  const configuredAddress = String(process.env.KITE_STABLE_TOKEN_ADDRESS ?? "").trim();
  const preset = parseKiteStablePreset(process.env.KITE_STABLE_TOKEN_PRESET);
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

function getNetworkConfig() {
  const key = resolveNetworkKey();

  if (key === "base_mainnet") {
    return {
      key,
      label: "Base Mainnet",
      chain: base,
      rpcUrl: (process.env.BASE_RPC_URL ?? "").trim() || undefined,
      escrowPrivateKey: String(process.env.BASE_ESCROW_PRIVATE_KEY ?? "").trim(),
      tokenSymbol: "USDC",
      tokenAddress: String(process.env.BASE_USDC_ADDRESS ?? "0x833589fCD6EDb6E08f4c7C32D4f71b54bdA02913").trim(),
      tokenDecimals: Number(process.env.BASE_USDC_DECIMALS ?? 6)
    };
  }

  if (key === "kite_testnet") {
    const stableToken = resolveKiteStableToken();

    return {
      key,
      label: "Kite AI Testnet",
      chain: KITE_TESTNET_CHAIN,
      rpcUrl: String(process.env.KITE_RPC_URL ?? "https://rpc-testnet.gokite.ai").trim(),
      escrowPrivateKey: String(
        process.env.KITE_ESCROW_PRIVATE_KEY ?? process.env.BASE_ESCROW_PRIVATE_KEY ?? ""
      ).trim(),
      tokenSymbol: stableToken.tokenSymbol,
      tokenAddress: stableToken.tokenAddress,
      tokenDecimals: stableToken.tokenDecimals
    };
  }

  return {
    key,
    label: "Base Sepolia",
    chain: baseSepolia,
    rpcUrl: (process.env.BASE_RPC_URL ?? "").trim() || undefined,
    escrowPrivateKey: String(process.env.BASE_ESCROW_PRIVATE_KEY ?? "").trim(),
    tokenSymbol: "USDC",
    tokenAddress: String(process.env.BASE_USDC_ADDRESS ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e").trim(),
    tokenDecimals: Number(process.env.BASE_USDC_DECIMALS ?? 6)
  };
}

function isAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value ?? ""));
}

function isNonceTooLowError(error) {
  const text = error instanceof Error ? error.message : String(error);
  return text.toLowerCase().includes("nonce too low");
}

async function main() {
  const network = getNetworkConfig();
  if (!network.escrowPrivateKey) {
    fail(
      network.key === "kite_testnet"
        ? "Missing KITE_ESCROW_PRIVATE_KEY (or BASE_ESCROW_PRIVATE_KEY fallback)."
        : "Missing BASE_ESCROW_PRIVATE_KEY."
    );
  }
  if (!isAddress(network.tokenAddress)) {
    fail(`Invalid stable token address for ${network.label}: ${network.tokenAddress}`);
  }
  if (!Number.isFinite(network.tokenDecimals) || network.tokenDecimals <= 0) {
    fail(`Invalid token decimals for ${network.label}.`);
  }
  if (!Number.isFinite(ETH_PER_WALLET) || ETH_PER_WALLET < 0) {
    fail("Native token amount must be >= 0.");
  }
  if (!Number.isFinite(STABLE_PER_WALLET) || STABLE_PER_WALLET < 0) {
    fail("Stable token amount must be >= 0.");
  }

  const { agents, configPath } = await loadRealAgentsConfig();
  const addresses = [...new Set(agents.map((agent) => String(agent?.baseWalletAddress ?? "").trim()).filter(Boolean))];
  if (addresses.length === 0) {
    fail(`No baseWalletAddress found in real-agent registry: ${configPath}`);
  }
  for (const address of addresses) {
    if (!isAddress(address)) {
      fail(`Invalid wallet address in real-agent registry: ${address}`);
    }
  }

  const escrow = privateKeyToAccount(network.escrowPrivateKey);
  const transport = http(network.rpcUrl);
  const publicClient = createPublicClient({ chain: network.chain, transport });
  const walletClient = createWalletClient({ account: escrow, chain: network.chain, transport });
  let nextNonce = await publicClient.getTransactionCount({ address: escrow.address, blockTag: "pending" });

  async function sendTxWithManagedNonce(txRequest) {
    while (true) {
      try {
        const hash = await walletClient.sendTransaction({
          ...txRequest,
          account: escrow,
          chain: network.chain,
          nonce: nextNonce
        });
        nextNonce += 1;
        return hash;
      } catch (error) {
        if (!isNonceTooLowError(error)) {
          throw error;
        }
        nextNonce = await publicClient.getTransactionCount({ address: escrow.address, blockTag: "pending" });
      }
    }
  }

  console.log(`Network: ${network.label}`);
  console.log(`Escrow: ${escrow.address}`);
  console.log(`Registry wallets: ${addresses.length} from ${configPath}`);
  console.log(`Funding each wallet with ${ETH_PER_WALLET} ${network.chain.nativeCurrency.symbol} and ${STABLE_PER_WALLET} ${network.tokenSymbol}.`);

  for (const address of addresses) {
    console.log(`\nFunding ${address}`);

    if (STABLE_PER_WALLET > 0) {
      const stableAmount = parseUnits(STABLE_PER_WALLET.toFixed(Math.min(network.tokenDecimals, 6)), network.tokenDecimals);
      const transferData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [address, stableAmount]
      });
      const stableHash = await sendTxWithManagedNonce({
        to: network.tokenAddress,
        data: transferData
      });
      await publicClient.waitForTransactionReceipt({ hash: stableHash });
      console.log(`  ${network.tokenSymbol} tx: ${stableHash}`);
    }

    if (ETH_PER_WALLET > 0) {
      const nativeHash = await sendTxWithManagedNonce({
        to: address,
        value: parseEther(ETH_PER_WALLET.toString())
      });
      await publicClient.waitForTransactionReceipt({ hash: nativeHash });
      console.log(`  ${network.chain.nativeCurrency.symbol} tx: ${nativeHash}`);
    }

    const [nativeBalance, stableBalance] = await Promise.all([
      publicClient.getBalance({ address }),
      publicClient.readContract({
        address: network.tokenAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address]
      })
    ]);
    console.log(
      `  New balances: ${formatEther(nativeBalance)} ${network.chain.nativeCurrency.symbol}, ${formatUnits(stableBalance, network.tokenDecimals)} ${network.tokenSymbol}`
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

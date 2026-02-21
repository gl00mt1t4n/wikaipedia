import { createPublicClient, createWalletClient, formatEther, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import { loadLocalEnv } from "./load-local-env.mjs";
import { loadRealAgentsConfig } from "./real-agents-config.mjs";

loadLocalEnv();

const DEFAULT_KITE_RPC_URL = "https://rpc-testnet.gokite.ai";
const ACTIVE_BID_NETWORK = String(process.env.ACTIVE_BID_NETWORK ?? "").trim().toLowerCase();
const LEGACY_X402_NETWORK = String(process.env.X402_BASE_NETWORK ?? "").trim();
const METAMASK_PRIVATE_KEY = String(process.env.METAMASK_PRIVATE_KEY ?? "").trim();
const FALLBACK_PRIVATE_KEY = String(process.env.GAS_FUNDER_PRIVATE_KEY ?? "").trim();
const GAS_PER_AGENT = process.argv[2] ? Number(process.argv[2]) : 0.01;
const AGENT_COUNT = process.argv[3] ? Number(process.argv[3]) : 2;

const KITE_TESTNET_CHAIN = {
  id: 2368,
  name: "Kite AI Testnet",
  nativeCurrency: { name: "KITE", symbol: "KITE", decimals: 18 },
  rpcUrls: {
    default: { http: [String(process.env.KITE_RPC_URL ?? DEFAULT_KITE_RPC_URL).trim()] },
    public: { http: [String(process.env.KITE_RPC_URL ?? DEFAULT_KITE_RPC_URL).trim()] }
  },
  blockExplorers: {
    default: { name: "KiteScan", url: "https://testnet.kitescan.ai" }
  },
  testnet: true
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

function isAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value ?? ""));
}

function isNonceTooLowError(error) {
  const text = error instanceof Error ? error.message : String(error);
  return text.toLowerCase().includes("nonce too low");
}

function toEtherAmountString(value) {
  const fixed = Number(value).toFixed(18);
  return fixed.replace(/\.?0+$/, "");
}

function normalizePrivateKey(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return "";
  }
  if (/^0x[a-fA-F0-9]{64}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) {
    return `0x${trimmed}`;
  }
  return trimmed;
}

function resolveNetworkKey() {
  if (ACTIVE_BID_NETWORK === "base_mainnet" || ACTIVE_BID_NETWORK === "base_sepolia" || ACTIVE_BID_NETWORK === "kite_testnet") {
    return ACTIVE_BID_NETWORK;
  }
  if (LEGACY_X402_NETWORK === "eip155:8453") {
    return "base_mainnet";
  }
  if (LEGACY_X402_NETWORK === "eip155:84532") {
    return "base_sepolia";
  }
  return "kite_testnet";
}

function getNetworkConfig() {
  const key = resolveNetworkKey();
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
    key,
    label: "Kite AI Testnet",
    chain: KITE_TESTNET_CHAIN,
    rpcUrl: String(process.env.KITE_RPC_URL ?? DEFAULT_KITE_RPC_URL).trim(),
    explorerTxBase: "https://testnet.kitescan.ai/tx/"
  };
}

async function main() {
  const network = getNetworkConfig();
  const fundingPrivateKey = normalizePrivateKey(METAMASK_PRIVATE_KEY || FALLBACK_PRIVATE_KEY);

  if (!fundingPrivateKey) {
    fail("Missing METAMASK_PRIVATE_KEY (or GAS_FUNDER_PRIVATE_KEY).");
  }
  if (!Number.isFinite(GAS_PER_AGENT) || GAS_PER_AGENT <= 0) {
    fail("Gas amount must be > 0.");
  }
  if (!Number.isFinite(AGENT_COUNT) || AGENT_COUNT <= 0) {
    fail("Agent count must be > 0.");
  }

  const { agents, configPath } = await loadRealAgentsConfig();
  const recipients = agents
    .slice(0, Math.floor(AGENT_COUNT))
    .map((agent) => ({
      id: String(agent?.id ?? "").trim(),
      name: String(agent?.name ?? "").trim(),
      address: String(agent?.baseWalletAddress ?? "").trim()
    }));

  if (recipients.length === 0) {
    fail(`No recipients found in ${configPath}.`);
  }
  for (const recipient of recipients) {
    if (!isAddress(recipient.address)) {
      fail(`Invalid baseWalletAddress for ${recipient.name || recipient.id}: ${recipient.address}`);
    }
  }

  let funder;
  try {
    funder = privateKeyToAccount(fundingPrivateKey);
  } catch {
    fail("Invalid private key format. Use a 64-hex key with or without 0x prefix.");
  }
  const transport = http(network.rpcUrl);
  const publicClient = createPublicClient({ chain: network.chain, transport });
  const walletClient = createWalletClient({ account: funder, chain: network.chain, transport });

  const initialBalance = await publicClient.getBalance({ address: funder.address });
  const perAgentAmount = parseEther(toEtherAmountString(GAS_PER_AGENT));
  const totalNeeded = perAgentAmount * BigInt(recipients.length);
  if (initialBalance < totalNeeded) {
    fail(
      `Insufficient ${network.chain.nativeCurrency.symbol} balance on funder ${funder.address}. ` +
        `Need ${formatEther(totalNeeded)}, have ${formatEther(initialBalance)}.`
    );
  }

  let nextNonce = await publicClient.getTransactionCount({
    address: funder.address,
    blockTag: "pending"
  });

  async function sendTxWithManagedNonce(txRequest) {
    while (true) {
      try {
        const hash = await walletClient.sendTransaction({
          ...txRequest,
          account: funder,
          chain: network.chain,
          nonce: nextNonce
        });
        nextNonce += 1;
        return hash;
      } catch (error) {
        if (!isNonceTooLowError(error)) {
          throw error;
        }
        nextNonce = await publicClient.getTransactionCount({
          address: funder.address,
          blockTag: "pending"
        });
      }
    }
  }

  console.log(`Network: ${network.label}`);
  console.log(`Funder: ${funder.address}`);
  console.log(`Funding first ${recipients.length} agent(s) from ${configPath}`);
  console.log(`Per-agent amount: ${GAS_PER_AGENT} ${network.chain.nativeCurrency.symbol}`);

  for (const recipient of recipients) {
    const txHash = await sendTxWithManagedNonce({
      to: recipient.address,
      value: perAgentAmount
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(
      `- ${recipient.name || recipient.id} ${recipient.address} tx=${txHash} explorer=${network.explorerTxBase}${txHash}`
    );
  }

  const endingBalance = await publicClient.getBalance({ address: funder.address });
  console.log(`Remaining funder balance: ${formatEther(endingBalance)} ${network.chain.nativeCurrency.symbol}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

import { createPublicClient, createWalletClient, formatEther, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { loadLocalEnv } from "../lib/load-local-env.mjs";
import { loadRealAgentsConfig } from "../lib/real-agents-config.mjs";
import {
  createNonceManagedSender,
  fail,
  getGasFundingNetworkConfig,
  isAddress
} from "../lib/funding-common.mjs";

loadLocalEnv();

const METAMASK_PRIVATE_KEY = String(process.env.METAMASK_PRIVATE_KEY ?? "").trim();
const FALLBACK_PRIVATE_KEY = String(process.env.GAS_FUNDER_PRIVATE_KEY ?? "").trim();
const GAS_PER_AGENT = process.argv[2] ? Number(process.argv[2]) : 0.01;
const AGENT_COUNT = process.argv[3] ? Number(process.argv[3]) : 2;

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

async function main() {
  const network = getGasFundingNetworkConfig({ defaultNetwork: "kite_testnet" });
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

  const sendTxWithManagedNonce = await createNonceManagedSender({
    publicClient,
    walletClient,
    account: funder,
    chain: network.chain
  });

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

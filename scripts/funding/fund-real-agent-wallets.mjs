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
import { loadLocalEnv } from "../lib/load-local-env.mjs";
import { loadRealAgentsConfig } from "../lib/real-agents-config.mjs";
import {
  ERC20_ABI,
  createNonceManagedSender,
  fail,
  getStableFundingNetworkConfig,
  isAddress
} from "../lib/funding-common.mjs";

loadLocalEnv();

const ETH_PER_WALLET = process.argv[2] ? Number(process.argv[2]) : 0.03;
const STABLE_PER_WALLET = process.argv[3] ? Number(process.argv[3]) : 2;

async function main() {
  const network = getStableFundingNetworkConfig({
    defaultNetwork: "base_sepolia",
    warningPrefix: "fund-real-agent-wallets"
  });

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
  const sendTxWithManagedNonce = await createNonceManagedSender({
    publicClient,
    walletClient,
    account: escrow,
    chain: network.chain
  });

  console.log(`Network: ${network.label}`);
  console.log(`Escrow: ${escrow.address}`);
  console.log(`Registry wallets: ${addresses.length} from ${configPath}`);
  console.log(
    `Funding each wallet with ${ETH_PER_WALLET} ${network.chain.nativeCurrency.symbol} and ${STABLE_PER_WALLET} ${network.tokenSymbol}.`
  );

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

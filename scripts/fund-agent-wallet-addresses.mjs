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
import { loadLocalEnv } from "./load-local-env.mjs";
import { getBuilderCode, getBuilderCodeDataSuffix } from "./builder-code.mjs";
import {
  ERC20_ABI,
  createNonceManagedSender,
  fail,
  getStableFundingNetworkConfig,
  isAddress
} from "./funding-common.mjs";

loadLocalEnv();

const ETH_PER_WALLET = process.argv[2] ? Number(process.argv[2]) : 0.005;
const STABLE_PER_WALLET = process.argv[3] ? Number(process.argv[3]) : 2;
const RAW_ADDRESSES = process.argv.slice(4).map((value) => String(value).trim()).filter(Boolean);

async function main() {
  const network = getStableFundingNetworkConfig({
    defaultNetwork: "base_sepolia",
    warningPrefix: "fund-agent-wallet-addresses"
  });

  if (!network.escrowPrivateKey) {
    fail(
      network.key === "kite_testnet"
        ? "Missing KITE_ESCROW_PRIVATE_KEY (or BASE_ESCROW_PRIVATE_KEY fallback)."
        : "Missing BASE_ESCROW_PRIVATE_KEY."
    );
  }
  if (!Number.isFinite(ETH_PER_WALLET) || ETH_PER_WALLET < 0) {
    fail("Native token amount must be >= 0.");
  }
  if (!Number.isFinite(STABLE_PER_WALLET) || STABLE_PER_WALLET < 0) {
    fail("Stable token amount must be >= 0.");
  }
  if (RAW_ADDRESSES.length === 0) {
    fail("Provide at least one wallet address.\nUsage: npm run agent:fund:wallets -- <native> <stable> <addr1> <addr2> ...");
  }

  const addresses = [...new Set(RAW_ADDRESSES.map((value) => value.toLowerCase()))];
  for (const address of addresses) {
    if (!isAddress(address)) {
      fail(`Invalid wallet address: ${address}`);
    }
  }

  if (!isAddress(network.tokenAddress)) {
    fail(`Invalid stable token address for ${network.label}: ${network.tokenAddress}`);
  }

  const escrow = privateKeyToAccount(network.escrowPrivateKey);
  const builderCode = network.supportsBuilderCode ? getBuilderCode() : null;
  const dataSuffix = network.supportsBuilderCode ? getBuilderCodeDataSuffix() : undefined;
  const txAttribution = dataSuffix ? { dataSuffix } : {};
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
  console.log(
    `Funding ${addresses.length} wallet(s) with ${ETH_PER_WALLET} ${network.chain.nativeCurrency.symbol} and ${STABLE_PER_WALLET} ${network.tokenSymbol} each.`
  );
  if (builderCode) {
    console.log(`Builder code attribution enabled: ${builderCode}`);
  }

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
        data: transferData,
        ...txAttribution
      });
      await publicClient.waitForTransactionReceipt({ hash: stableHash });
      console.log(`  ${network.tokenSymbol} tx: ${stableHash}`);
    }

    if (ETH_PER_WALLET > 0) {
      const nativeHash = await sendTxWithManagedNonce({
        to: address,
        value: parseEther(ETH_PER_WALLET.toString()),
        data: "0x",
        ...txAttribution
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

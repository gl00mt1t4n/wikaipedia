import { encodeFunctionData, http, createWalletClient, createPublicClient, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getBuilderCodeDataSuffix } from "@/lib/builderCode";
import { getActiveBidNetworkConfig } from "@/lib/paymentNetwork";

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
  }
] as const;

function requireEscrowPrivateKey(): `0x${string}` {
  const config = getActiveBidNetworkConfig();
  const value = (
    config.chainKind === "kite"
      ? process.env.KITE_ESCROW_PRIVATE_KEY ?? process.env.BASE_ESCROW_PRIVATE_KEY ?? process.env.PRIVATE_KEY ?? ""
      : process.env.BASE_ESCROW_PRIVATE_KEY ?? process.env.PRIVATE_KEY ?? ""
  ).trim();

  if (!value) {
    throw new Error(
      config.chainKind === "kite"
        ? "Missing KITE_ESCROW_PRIVATE_KEY (or BASE_ESCROW_PRIVATE_KEY / PRIVATE_KEY)."
        : "Missing BASE_ESCROW_PRIVATE_KEY (or PRIVATE_KEY)."
    );
  }

  return value as `0x${string}`;
}

function getEscrowAccount() {
  return privateKeyToAccount(requireEscrowPrivateKey());
}

export function getEscrowPayToAddress(): string {
  const config = getActiveBidNetworkConfig();

  const explicit = (
    config.chainKind === "kite"
      ? process.env.X402_PAY_TO_KITE ?? process.env.X402_PAY_TO ?? ""
      : process.env.X402_PAY_TO_BASE ?? process.env.X402_PAY_TO ?? ""
  ).trim();

  if (explicit) {
    return explicit.toLowerCase();
  }

  return getEscrowAccount().address.toLowerCase();
}

export async function disburseWinnerPayout(input: {
  to: string;
  amountCents: number;
}): Promise<{ txHash: string; amountBaseUnits: string; paymentNetwork: string; tokenAddress: string; tokenSymbol: string }> {
  const config = getActiveBidNetworkConfig();
  const account = getEscrowAccount();
  const to = input.to as `0x${string}`;
  const tokenAddress = config.payoutToken.address;
  const amount = parseUnits((Math.max(0, input.amountCents) / 100).toFixed(Math.min(config.payoutToken.decimals, 6)), config.payoutToken.decimals);
  const dataSuffix = config.supportsBuilderCode ? getBuilderCodeDataSuffix() : undefined;
  const txAttribution = dataSuffix ? { dataSuffix } : {};

  const transport = http(config.rpcUrl);
  const walletClient = createWalletClient({ account, chain: config.chain, transport });
  const publicClient = createPublicClient({ chain: config.chain, transport });

  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [to, amount]
  });

  const txHash = await walletClient.sendTransaction({
    to: tokenAddress,
    data,
    ...txAttribution,
    account,
    chain: config.chain
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    txHash,
    amountBaseUnits: amount.toString(),
    paymentNetwork: config.x402Network,
    tokenAddress,
    tokenSymbol: config.payoutToken.symbol
  };
}

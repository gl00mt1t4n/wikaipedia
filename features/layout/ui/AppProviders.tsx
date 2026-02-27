"use client";

import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { base, baseSepolia } from "viem/chains";
import { hederaTestnet } from "@/shared/chains/hederaChains";
import { FormModalProvider } from "@/features/layout/ui/FormModalContext";
import { FormModal } from "@/features/layout/ui/FormModal";

const PRIVY_APP_ID = String(process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "").trim();
const NETWORK = String(process.env.NEXT_PUBLIC_AUTH_WALLET_NETWORK ?? "eip155:84532").trim();

const defaultChain =
  NETWORK === "eip155:296"
    ? hederaTestnet
    : NETWORK === "eip155:8453"
      ? base
      : baseSepolia;

export function AppProviders({ children }: { children: ReactNode }) {
  const inner = (
    <FormModalProvider>
      {children}
      <FormModal />
    </FormModalProvider>
  );

  if (!PRIVY_APP_ID) {
    return <>{inner}</>;
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["wallet"],
        supportedChains: [hederaTestnet, baseSepolia, base],
        defaultChain,
        appearance: {
          showWalletLoginFirst: true,
          walletChainType: "ethereum-only",
          walletList: ["metamask", "phantom", "detected_ethereum_wallets", "wallet_connect"]
        }
      }}
    >
      {inner}
    </PrivyProvider>
  );
}

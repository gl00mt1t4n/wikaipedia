"use client";

import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { FormModalProvider } from "@/frontend/layout/FormModalContext";
import { FormModal } from "@/frontend/layout/FormModal";

const PRIVY_APP_ID = String(process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "").trim();

// App providers helper.
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
    <PrivyProvider appId={PRIVY_APP_ID}>
      {inner}
    </PrivyProvider>
  );
}

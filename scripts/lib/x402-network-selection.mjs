export function mapActiveBidNetworkToCaip(input) {
  const value = String(input ?? "").trim().toLowerCase();
  if (value === "base_mainnet") {
    return "eip155:8453";
  }
  if (value === "kite_testnet") {
    return "eip155:2368";
  }
  if (value === "base_sepolia") {
    return "eip155:84532";
  }
  return null;
}

export function resolveX402Network(options = {}) {
  const activeBidNetwork = String(options.activeBidNetwork ?? "").trim().toLowerCase();
  const legacyX402BaseNetwork = String(options.legacyX402BaseNetwork ?? "").trim();
  const fallback = String(options.fallback ?? "eip155:84532").trim() || "eip155:84532";
  const logPrefix = String(options.logPrefix ?? "x402").trim() || "x402";

  const activeNetworkCaip = mapActiveBidNetworkToCaip(activeBidNetwork) ?? fallback;
  if (legacyX402BaseNetwork) {
    if (legacyX402BaseNetwork !== activeNetworkCaip) {
      console.warn(
        `[${logPrefix}] ignoring legacy X402_BASE_NETWORK=${legacyX402BaseNetwork}; using ACTIVE_BID_NETWORK=${activeBidNetwork || "base_sepolia"} => ${activeNetworkCaip}.`
      );
    } else {
      console.warn(`[${logPrefix}] legacy X402_BASE_NETWORK is set but ignored.`);
    }
  }

  return activeNetworkCaip;
}

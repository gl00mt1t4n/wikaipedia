import { NextResponse } from "next/server";
import { getAddress } from "viem";
import { UNISWAP_CHAIN_ID, UniswapApiError, extractTxRequest, uniswapCheckApproval } from "@/features/payments/server/uniswapApi";
import { allowedUniswapTokenSymbols, isHexAddress, resolveAllowedUniswapToken } from "@/features/payments/server/uniswapRouteHelpers";

export const runtime = "nodejs";

type CheckApprovalBody = {
  tokenIn?: unknown;
  amountIn?: unknown;
  walletAddress?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CheckApprovalBody | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const tokenIn = String(body.tokenIn ?? "").trim();
  const amountIn = String(body.amountIn ?? "").trim();
  const walletAddress = String(body.walletAddress ?? "").trim();

  if (!tokenIn || !/^\d+$/.test(amountIn) || !isHexAddress(walletAddress)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid request body",
        details: {
          tokenIn: "required",
          amountIn: "must be a decimal string (wei/base-units)",
          walletAddress: "must be a valid 0x address"
        }
      },
      { status: 400 }
    );
  }

  const resolvedIn = resolveAllowedUniswapToken(tokenIn);
  if (!resolvedIn) {
    return NextResponse.json(
      { ok: false, error: `Unknown or disallowed tokenIn: ${tokenIn}. Allowed: ${allowedUniswapTokenSymbols()}` },
      { status: 400 }
    );
  }

  try {
    const payload = await uniswapCheckApproval({
      chainId: UNISWAP_CHAIN_ID,
      token: resolvedIn,
      amount: amountIn,
      walletAddress: getAddress(walletAddress)
    });
    const txRequest = extractTxRequest(payload);
    return NextResponse.json({
      ok: true,
      chainId: UNISWAP_CHAIN_ID,
      approvalRequired: Boolean(txRequest),
      txRequest
    });
  } catch (error) {
    const status = error instanceof UniswapApiError ? 502 : 500;
    return NextResponse.json(
      {
        ok: false,
        error: "Approval check failed",
        message: error instanceof Error ? error.message : String(error)
      },
      { status }
    );
  }
}

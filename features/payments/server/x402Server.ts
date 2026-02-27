import {
  HTTPFacilitatorClient,
  x402HTTPResourceServer,
  x402ResourceServer,
  type HTTPAdapter,
  type HTTPRequestContext,
  type RouteConfig
} from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { NextResponse } from "next/server";
import { getLocalX402FacilitatorClient } from "@/features/payments/server/localX402Facilitator";
import { getActiveBidNetworkConfig } from "@/features/payments/server/paymentNetwork";

const ACTIVE_NETWORK_CONFIG = getActiveBidNetworkConfig();
const FACILITATOR_URL = ACTIVE_NETWORK_CONFIG.facilitatorUrl;
export const X402_ACTIVE_NETWORK = ACTIVE_NETWORK_CONFIG.x402Network as Network;
const USE_LOCAL_FACILITATOR = (process.env.X402_USE_LOCAL_FACILITATOR ?? "1").trim() !== "0";

const facilitator = USE_LOCAL_FACILITATOR
  ? getLocalX402FacilitatorClient(X402_ACTIVE_NETWORK)
  : new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitator);
registerExactEvmScheme(resourceServer, { networks: [X402_ACTIVE_NETWORK] });

let initializationPromise: Promise<void> | null = null;
let settlementQueue: Promise<void> = Promise.resolve();

async function initializeServer(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = resourceServer.initialize();
  }
  await initializationPromise;
}

async function runSettlementSerial<T>(task: () => Promise<T>): Promise<T> {
  const previous = settlementQueue;
  let release!: () => void;

  settlementQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous.catch(() => {});

  try {
    return await task();
  } finally {
    release();
  }
}

class NextHttpAdapter implements HTTPAdapter {
  constructor(private readonly request: Request) {}

  getHeader(name: string): string | undefined {
    return this.request.headers.get(name) ?? undefined;
  }

  getMethod(): string {
    return this.request.method;
  }

  getPath(): string {
    return new URL(this.request.url).pathname;
  }

  getUrl(): string {
    return this.request.url;
  }

  getAcceptHeader(): string {
    return this.request.headers.get("accept") ?? "";
  }

  getUserAgent(): string {
    return this.request.headers.get("user-agent") ?? "";
  }
}

function toResponseInstructions(result: {
  status: number;
  headers: Record<string, string>;
  body?: unknown;
}) {
  const contentType = result.headers["Content-Type"] ?? result.headers["content-type"];

  if (!contentType || contentType.includes("application/json")) {
    return NextResponse.json(result.body ?? {}, {
      status: result.status,
      headers: result.headers
    });
  }

  return new NextResponse(typeof result.body === "string" ? result.body : JSON.stringify(result.body ?? {}), {
    status: result.status,
    headers: result.headers
  });
}

function decodePaymentRequiredError(headers: Record<string, string>): string | null {
  const encoded = headers["payment-required"] ?? headers["Payment-Required"];
  if (!encoded) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as { error?: unknown };
    const error = typeof decoded?.error === "string" ? decoded.error.trim() : "";
    return error || null;
  } catch {
    return null;
  }
}

export type PaidRouteContext = {
  paymentVerified: boolean;
  settlementTransaction: string | null;
  settlementNetwork: Network | null;
};

export type PaidRouteLifecycleEvent =
  | {
      type: "X402_PAYMENT_REQUIRED";
      httpStatus: number;
      errorMessage: string | null;
    }
  | {
      type: "X402_SETTLEMENT_ATTEMPTED";
      network: Network;
    }
  | {
      type: "X402_SETTLEMENT_CONFIRMED";
      network: Network;
      transaction: string | null;
    }
  | {
      type: "X402_SETTLEMENT_FAILED";
      network: Network;
      errorMessage: string;
      errorCode: string | null;
      httpStatus: number;
    };

type HandlePaidRouteOptions = {
  onLifecycleEvent?: (event: PaidRouteLifecycleEvent) => Promise<void> | void;
};

async function emitLifecycleEvent(
  options: HandlePaidRouteOptions | undefined,
  event: PaidRouteLifecycleEvent
): Promise<void> {
  if (!options?.onLifecycleEvent) {
    return;
  }

  try {
    await options.onLifecycleEvent(event);
  } catch {}
}

export async function handlePaidRoute(
  request: Request,
  routeConfig: RouteConfig,
  onPaidRequest: (context: PaidRouteContext) => Promise<NextResponse>,
  options?: HandlePaidRouteOptions
): Promise<NextResponse> {
  try {
    await initializeServer();
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "x402 facilitator initialization failed."
      },
      { status: 500 }
    );
  }

  const httpServer = new x402HTTPResourceServer(resourceServer, routeConfig);
  const adapter = new NextHttpAdapter(request);
  const context: HTTPRequestContext = {
    adapter,
    path: adapter.getPath(),
    method: adapter.getMethod()
  };

  let paymentState;
  try {
    paymentState = await httpServer.processHTTPRequest(context);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process x402 payment request."
      },
      { status: 500 }
    );
  }

  if (paymentState.type === "payment-error") {
    const headerError = decodePaymentRequiredError(paymentState.response.headers);
    if (paymentState.response.status === 402) {
      await emitLifecycleEvent(options, {
        type: "X402_PAYMENT_REQUIRED",
        httpStatus: 402,
        errorMessage: headerError
      });
    }

    if (
      headerError &&
      (!paymentState.response.body ||
        typeof paymentState.response.body !== "object" ||
        typeof (paymentState.response.body as { error?: unknown }).error !== "string")
    ) {
      return NextResponse.json(
        { error: headerError },
        {
          status: paymentState.response.status,
          headers: paymentState.response.headers
        }
      );
    }

    return toResponseInstructions(paymentState.response);
  }
  let settlementHeaders: Record<string, string> | null = null;
  let paidContext: PaidRouteContext = {
    paymentVerified: false,
    settlementTransaction: null,
    settlementNetwork: null
  };

  if (paymentState.type === "payment-verified") {
    await emitLifecycleEvent(options, {
      type: "X402_SETTLEMENT_ATTEMPTED",
      network: X402_ACTIVE_NETWORK
    });

    let settlement;
    try {
      settlement = await runSettlementSerial(() =>
        httpServer.processSettlement(
          paymentState.paymentPayload,
          paymentState.paymentRequirements,
          paymentState.declaredExtensions
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to settle x402 payment.";
      await emitLifecycleEvent(options, {
        type: "X402_SETTLEMENT_FAILED",
        network: X402_ACTIVE_NETWORK,
        errorMessage: message,
        errorCode: null,
        httpStatus: 500
      });
      return NextResponse.json(
        {
          error: message
        },
        { status: 500 }
      );
    }

    if (!settlement.success) {
      const errorMessage = settlement.errorMessage ?? settlement.errorReason ?? "Payment settlement failed.";
      await emitLifecycleEvent(options, {
        type: "X402_SETTLEMENT_FAILED",
        network: settlement.network ?? X402_ACTIVE_NETWORK,
        errorMessage,
        errorCode: settlement.errorReason ?? null,
        httpStatus: 402
      });
      return NextResponse.json(
        {
          error: errorMessage
        },
        { status: 402 }
      );
    }

    settlementHeaders = settlement.headers;
    paidContext = {
      paymentVerified: true,
      settlementTransaction: settlement.transaction?.trim() || null,
      settlementNetwork: settlement.network ?? null
    };

    await emitLifecycleEvent(options, {
      type: "X402_SETTLEMENT_CONFIRMED",
      network: settlement.network ?? X402_ACTIVE_NETWORK,
      transaction: settlement.transaction?.trim() || null
    });
  }

  let response;
  try {
    response = await onPaidRequest(paidContext);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Paid route handler failed."
      },
      { status: 500 }
    );
  }

  if (settlementHeaders) {
    for (const [key, value] of Object.entries(settlementHeaders)) {
      response.headers.set(key, value);
    }
  }

  return response;
}

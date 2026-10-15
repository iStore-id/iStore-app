import {
  buildOmqrisFulfillmentIdempotencyKey,
  isOmqrisAuthoritativeLatePaid,
  isOmqrisStaleTerminalEvent
} from "./omqris-contract.js";

export interface OmqrisLifecycleDependencies {
  transitionOrderState: (orderId: string, targetState: string, payload: Record<string, unknown>, reason: string) => Promise<unknown>;
  getOrderById: (orderId: string) => Promise<any>;
  recordPaymentReceived: (orderId: string, order: any, source: string) => Promise<unknown>;
  enqueueFulfillment: (orderId: string, idempotencyKey: string) => Promise<unknown>;
  markProcessed: () => void;
  clearProcessing: () => void;
}

export interface OmqrisLifecycleInput {
  orderId: string;
  targetState: string;
  eventStatus: string;
  order: any;
}

export interface OmqrisLifecycleResult {
  statusCode: 200 | 500;
  body: { status?: string; success?: boolean; message: string };
}

/**
 * Runs the state transition and payment side effects for an already verified OmQris callback.
 * Dependencies are injected so the same production lifecycle can be exercised without production data.
 */
export async function processOmqrisCallbackLifecycle(
  input: OmqrisLifecycleInput,
  deps: OmqrisLifecycleDependencies
): Promise<OmqrisLifecycleResult> {
  const { orderId, targetState, eventStatus, order } = input;
  const fulfillmentKey = buildOmqrisFulfillmentIdempotencyKey(orderId);

  try {
    await deps.transitionOrderState(
      orderId,
      targetState,
      isOmqrisAuthoritativeLatePaid(order.paymentGatewayCode, order.paymentStatus, eventStatus)
        ? { omqrisAuthoritativePaid: true }
        : {},
      `OmQris Webhook: ${eventStatus}`
    );

    if (targetState === "PAID") {
      await deps.recordPaymentReceived(orderId, order, "OmQris Webhook");
      try {
        await deps.enqueueFulfillment(orderId, fulfillmentKey);
      } catch {
        deps.clearProcessing();
        return { statusCode: 500, body: { success: false, message: "Payment recorded; fulfillment enqueue failed" } };
      }
    }
    deps.markProcessed();
    return { statusCode: 200, body: { status: "ok", message: "Callback processed" } };
  } catch (stateError: any) {
    if (!String(stateError?.message || "").includes("INVALID_STATE_TRANSITION")) {
      deps.clearProcessing();
      throw stateError;
    }

    if (targetState === "PAID") {
      const refreshedOrder = await deps.getOrderById(orderId);
      if (refreshedOrder?.paymentStatus === "paid") {
        await deps.recordPaymentReceived(orderId, refreshedOrder, "OmQris Webhook Retry");
        await deps.enqueueFulfillment(orderId, fulfillmentKey);
        deps.markProcessed();
        return { statusCode: 200, body: { status: "ok", message: "Already processed" } };
      }
      deps.clearProcessing();
      return { statusCode: 500, body: { success: false, message: "Authoritative payment requires reconciliation" } };
    }

    const refreshedOrder = await deps.getOrderById(orderId);
    const refreshedStatus = String(refreshedOrder?.paymentStatus || "").toLowerCase();
    const expectedTerminal = targetState === "EXPIRED" ? "expired" : "failed";
    if (refreshedStatus === expectedTerminal || isOmqrisStaleTerminalEvent(refreshedStatus, eventStatus)) {
      deps.markProcessed();
      return { statusCode: 200, body: { status: "ok", message: "Stale or already processed terminal event" } };
    }
    deps.clearProcessing();
    return { statusCode: 500, body: { success: false, message: "Order state requires reconciliation" } };
  }
}

/**
 * WDK Payment Client — Tether WDK USDT transfers for inter-agent payments.
 *
 * When a service returns 402, the coordinator pays via WDK USDT transfer.
 * In demo mode, payments are logged but not executed.
 */

import { createLogger } from "../lib/logger.js";
import { sendUSDT, getAgentAddress, isDemoMode, createAgentWallet } from "../lib/wdk-wallet.js";
import { config } from "../config/env.js";
import type { WDKFetchResult } from "../types/index.js";

const log = createLogger("coordinator");

const SUB_CALL_TIMEOUT = 15_000;
const PAYMENT_MAX_RETRIES = 2;
const PAYMENT_RETRY_BASE_MS = 400;

// Safety cap: no single service call should cost more than $1
const MAX_PAYMENT_USDT = 1.0;

// walletClient export for backward compatibility (checked by health endpoint)
export const walletClient = isDemoMode() ? null : {};

/**
 * WDK-aware fetch: calls a service endpoint.
 * If the service requires payment (402), pays via WDK USDT transfer.
 */
export async function wdkFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs = SUB_CALL_TIMEOUT,
  signal?: AbortSignal,
): Promise<WDKFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  signal?.addEventListener("abort", onExternalAbort, { once: true });

  try {
    // In demo mode, use internal bypass since WDK payments can't execute.
    // In live mode, skip bypass to trigger real WDK USDT payments.
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };
    if (isDemoMode()) {
      headers["x-internal"] = config.internalSecret;
    }

    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers,
    });
    clearTimeout(timer);

    if (res.status !== 402) {
      const data = await res.json().catch(() => null);
      const acpHeaders = extractACPHeaders(res);
      return { ok: res.ok, status: res.status, data, paid: false, ...(acpHeaders ? { acpHeaders } : {}) };
    }

    // Service requires payment — pay via WDK USDT
    const body = await res.json().catch(() => null) as Record<string, unknown> | null;
    const priceStr = body?.["price"] as string | undefined;
    let price = priceStr ? parseFloat(priceStr.replace("$", "")) : 0.001;

    if (price > MAX_PAYMENT_USDT) {
      log.warn("402 price exceeds safety cap — clamping", {
        requested: price,
        cap: MAX_PAYMENT_USDT,
        url: url.split("/").pop(),
      });
      price = MAX_PAYMENT_USDT;
    }

    // Extract target service address from response or URL
    const targetAddress = (body?.["walletAddress"] as string | undefined) ?? extractServiceAddress(url);

    if (isDemoMode()) {
      const amount = `$${price.toFixed(3)}`;
      log.info("demo WDK payment", { url: url.split("/").pop(), amount });
      return {
        ok: false,
        status: 402,
        demoMode: true,
        paymentRequired: { description: "WDK USDT payment", amount },
        data: null,
        paid: false,
      };
    }

    // Attempt WDK payment with retries
    for (let attempt = 0; attempt <= PAYMENT_MAX_RETRIES; attempt++) {
      const transfer = await sendUSDT("hunter", targetAddress as `0x${string}`, price);

      if (transfer.success) {
        // Retry the original request with payment proof
        const paidRes = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            ...(options.headers as Record<string, string>),
            "X-WDK-PAYMENT": transfer.txHash ?? "",
            "X-WDK-AMOUNT": price.toString(),
          },
        });

        const data = await paidRes.json().catch(() => null);
        return { ok: paidRes.ok, status: paidRes.status, data, paid: true, txHash: transfer.txHash ?? undefined };
      }

      if (attempt < PAYMENT_MAX_RETRIES) {
        const delay = PAYMENT_RETRY_BASE_MS * (attempt + 1) + Math.random() * 200;
        log.info("WDK payment retry", { url: url.split("/").pop(), attempt: attempt + 1, delayMs: Math.round(delay) });
        await new Promise(r => setTimeout(r, delay));
      }
    }

    log.warn("WDK payment failed after retries", { url: url.split("/").pop() });
    return { ok: false, status: 402, data: null, paid: false };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  } finally {
    signal?.removeEventListener("abort", onExternalAbort);
  }
}

function extractServiceAddress(url: string): string {
  // Map service URLs to their WDK wallet addresses
  const port = new URL(url).port;
  const portMap: Record<string, string> = {
    "4001": "sentiment",
    "4002": "polymarket",
    "4003": "defi",
    "4004": "news",
    "4005": "whale",
    "4006": "sentiment2",
  };
  const agentKey = portMap[port] ?? "unknown";
  return getAgentAddress(agentKey);
}

const ACP_HEADER_KEYS = ["x-acp-confidence", "x-acp-stake", "x-acp-direction", "x-acp-version"];

function extractACPHeaders(res: Response): Record<string, string> | null {
  const headers: Record<string, string> = {};
  let found = false;
  for (const key of ACP_HEADER_KEYS) {
    const val = res.headers.get(key);
    if (val) { headers[key] = val; found = true; }
  }
  return found ? headers : null;
}

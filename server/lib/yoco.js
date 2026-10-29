// Yoco Checkout API client (server-side only).
//
// The secret key never reaches the browser: the app asks this service to create
// a checkout, then sends the owner to Yoco's hosted payment page. A payment is
// only ever treated as settled from a signed Yoco webhook — the return URL the
// browser lands on is not proof of payment.
import { BILLING_CURRENCY } from "./billing-plans.js";

const CHECKOUTS_URL = "https://payments.yoco.com/api/checkouts";

export function yocoConfigured() {
  return Boolean(process.env.YOCO_SECRET_KEY);
}

export function yocoWebhookConfigured() {
  return Boolean(process.env.YOCO_WEBHOOK_SECRET);
}

/**
 * Create a hosted checkout and return `{ id, redirectUrl, status }`.
 * `reference` doubles as Yoco's idempotency key, so a retried request cannot
 * create a second charge for the same payment row.
 */
export async function createYocoCheckout({
  amountCents,
  reference,
  metadata,
  successUrl,
  cancelUrl,
  failureUrl,
}) {
  const response = await fetch(CHECKOUTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.YOCO_SECRET_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": reference,
    },
    body: JSON.stringify({
      amount: amountCents,
      currency: BILLING_CURRENCY,
      successUrl,
      cancelUrl,
      failureUrl,
      metadata,
      externalId: reference,
      clientReferenceId: reference,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body?.message || body?.reason || `HTTP ${response.status}`;
    throw new Error(`Yoco could not start the checkout: ${detail}`);
  }
  if (!body?.redirectUrl) {
    throw new Error("Yoco did not return a payment page.");
  }
  return body;
}

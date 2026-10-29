// Yoco payment webhook.
//
// The checkout return URL only tells the browser where to go; this signed event
// is what settles a subscription. Yoco signs with Standard Webhooks headers
// (`webhook-id`, `webhook-timestamp`, `webhook-signature`), verified over the
// raw body before anything is trusted.
//
// Events are idempotent and safe against duplicates and late deliveries: the
// database function ignores a payment it has already settled, never shortens a
// newer period, and refuses an amount that does not match the checkout.
import { callRpc, selectRows, supabaseRestConfigured } from "./supabase-rest.js";
import { verifyWebhookSignature } from "./webhook-signature.js";
import { yocoWebhookConfigured } from "./yoco.js";

function enc(value) {
  return encodeURIComponent(String(value));
}

function header(headers, name) {
  return headers?.[name] || headers?.[`svix-${name.replace(/^webhook-/, "")}`];
}

export async function handleYocoWebhook({ rawBody, headers, respond }) {
  if (!yocoWebhookConfigured()) {
    return respond(503, { error: "YOCO_WEBHOOK_SECRET is missing." });
  }

  const verification = verifyWebhookSignature({
    secret: process.env.YOCO_WEBHOOK_SECRET,
    payload: rawBody,
    id: header(headers, "webhook-id"),
    timestamp: header(headers, "webhook-timestamp"),
    signature: header(headers, "webhook-signature"),
  });
  if (!verification.ok) {
    console.warn(`[yoco-webhook] rejected: ${verification.reason}`);
    return respond(verification.status, { error: verification.reason });
  }

  if (!supabaseRestConfigured()) {
    return respond(503, { error: "Supabase is not configured on the API service." });
  }

  let event;
  try {
    event = JSON.parse(rawBody || "{}");
  } catch {
    return respond(400, { error: "Invalid JSON body" });
  }

  const type = event.type || event.event_type;
  // The Yoco API also delivers events for card-machine payments; only the
  // Checkout API's payment notifications belong to subscriptions.
  if (type !== "payment.succeeded" && type !== "payment.failed") {
    return respond(200, { ok: true, ignored: type || "unknown" });
  }

  const payload = event.payload || event.data || {};
  const metadata = payload.metadata || event.metadata || {};
  const paymentId = String(metadata.payment_id || "").trim();
  if (!paymentId) {
    console.warn("[yoco-webhook] event carries no payment reference");
    return respond(200, { ok: true, ignored: "no payment reference" });
  }

  const providerPaymentId = payload.id ? String(payload.id) : null;

  try {
    const rows = await selectRows(
      "subscription_payment",
      `select=id,shop_id,plan,amount_cents,currency,status&id=eq.${enc(paymentId)}&limit=1`
    );
    const payment = rows?.[0];
    if (!payment) {
      console.warn(`[yoco-webhook] unknown payment ${paymentId}`);
      return respond(200, { ok: true, ignored: "unknown payment" });
    }

    if (type === "payment.failed") {
      const result = await callRpc("mark_subscription_payment_failed", {
        p_payment_id: paymentId,
        p_reason: String(event.type ? "Yoco reported the payment as failed." : "Payment failed."),
      });
      return respond(200, { ok: true, ...result });
    }

    // Never activate a payment for the wrong amount or currency.
    const amount = payload.amount;
    if (
      (typeof amount === "number" && amount !== payment.amount_cents) ||
      (payload.currency && String(payload.currency).toUpperCase() !== "ZAR")
    ) {
      console.error(
        `[yoco-webhook] payment ${paymentId} settled for ${amount} ${payload.currency}, ` +
          `expected ${payment.amount_cents} ZAR — not activating`
      );
      await callRpc("mark_subscription_payment_failed", {
        p_payment_id: paymentId,
        p_reason: "Amount or currency did not match the checkout.",
      }).catch(() => {});
      return respond(200, { ok: true, ignored: "amount mismatch" });
    }

    const paidAt = payload.createdDate || event.createdDate || new Date().toISOString();
    const result = await callRpc("apply_subscription_payment", {
      p_payment_id: paymentId,
      p_provider_payment_id: providerPaymentId,
      p_amount_cents: payment.amount_cents,
      p_paid_at: paidAt,
    });
    return respond(200, { ok: true, ...result });
  } catch (error) {
    // A transient database failure gets a 500 so Yoco retries the delivery.
    console.error(`[yoco-webhook] ${paymentId}: ${error.message}`);
    return respond(500, { error: "Could not record the payment yet" });
  }
}

// Start a paid-plan purchase: create a pending payment, ask Yoco for a hosted
// checkout, and hand the owner the payment page URL.
//
// The price comes from server/lib/billing-plans.js, the shop is resolved from
// the caller's own session (a branch they own bills the same subscription), and
// the row is written with the service role. Nothing here activates a plan — that
// only happens when Yoco's signed webhook settles the payment.
import { randomBytes } from "node:crypto";
import { BILLING_CURRENCY, billingPlan } from "./billing-plans.js";
import { appUrl, authenticate, resolveShop } from "./invite-core.js";
import { insertRow, selectRows, supabaseRestConfigured, updateRows } from "./supabase-rest.js";
import { createYocoCheckout, yocoConfigured } from "./yoco.js";

function enc(value) {
  return encodeURIComponent(String(value));
}

function paymentId() {
  return randomBytes(12).toString("hex");
}

/**
 * The account that owns the subscription. A branch bills its owner, so the
 * payment row is always filed under the owner's auth id (what
 * `shop_subscription.shop_id` uses).
 */
async function subscriptionOwner(caller, shopId) {
  if (!shopId || shopId === caller.id) return caller.id;
  try {
    const rows = await selectRows("shop", `select=id,owner_id&id=eq.${enc(shopId)}&limit=1`);
    return rows?.[0]?.owner_id || null;
  } catch {
    return null;
  }
}

/** An employee works under the owner's plan and cannot buy one. */
async function isEmployee(caller) {
  try {
    const rows = await selectRows(
      "shop_member",
      `select=shop_id&member_id=eq.${enc(caller.id)}&status=eq.active&limit=1`
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

export async function handleCreateCheckout({ rawBody, headers, respond }) {
  if (!yocoConfigured()) {
    return respond(503, { error: "Online payments are not configured yet (YOCO_SECRET_KEY is missing)." });
  }
  if (!supabaseRestConfigured()) {
    return respond(503, { error: "Supabase is not configured on the API service." });
  }

  const caller = await authenticate(headers.authorization);
  if (!caller) return respond(401, { error: "Sign in to pay for a plan." });

  let body;
  try {
    body = JSON.parse(rawBody || "{}");
  } catch {
    return respond(400, { error: "Invalid JSON body" });
  }

  const plan = billingPlan(String(body.plan || "").trim());
  if (!plan) return respond(400, { error: "Choose the Premium or Ultra plan." });

  if (await isEmployee(caller)) {
    return respond(403, { error: "Only the shop owner can pay for the subscription." });
  }

  const requestedShop = String(body.shopId || "").trim();
  const shopId = await resolveShop(caller, requestedShop);
  if (!shopId) {
    return respond(403, { error: "You can only pay for a shop you own." });
  }
  const ownerId = await subscriptionOwner(caller, shopId);
  if (!ownerId || ownerId !== caller.id) {
    return respond(403, { error: "You can only pay for a shop you own." });
  }

  const base = appUrl(headers);
  if (!base) return respond(503, { error: "Payment links need APP_URL set on the API service." });

  const id = paymentId();
  try {
    await insertRow("subscription_payment", {
      id,
      shop_id: ownerId,
      plan: String(body.plan).trim(),
      amount_cents: plan.amountCents,
      currency: BILLING_CURRENCY,
      status: "pending",
      provider: "yoco",
      created_by_id: caller.id,
    });
  } catch (error) {
    console.error(`[billing] could not record the payment: ${error.message}`);
    return respond(500, { error: "Could not start the payment. Try again." });
  }

  const returnUrl = `${base}/settings?tab=billing&yoco=return&payment=${enc(id)}`;

  let checkout;
  try {
    checkout = await createYocoCheckout({
      amountCents: plan.amountCents,
      reference: id,
      metadata: { payment_id: id, shop_id: ownerId, plan: String(body.plan).trim() },
      successUrl: returnUrl,
      cancelUrl: `${base}/settings?tab=billing&yoco=cancel`,
      failureUrl: `${base}/settings?tab=billing&yoco=failed&payment=${enc(id)}`,
    });
  } catch (error) {
    await updateRows("subscription_payment", `id=eq.${enc(id)}`, {
      status: "failed",
      failure_reason: error.message.slice(0, 300),
      updated_date: new Date().toISOString(),
    }).catch(() => {});
    console.error(`[billing] Yoco checkout failed: ${error.message}`);
    return respond(502, { error: error.message });
  }

  await updateRows("subscription_payment", `id=eq.${enc(id)}`, {
    provider_checkout_id: checkout.id || null,
    redirect_url: checkout.redirectUrl,
    updated_date: new Date().toISOString(),
  }).catch(() => {});

  return respond(201, {
    payment_id: id,
    plan: String(body.plan).trim(),
    amount_cents: plan.amountCents,
    currency: BILLING_CURRENCY,
    redirect_url: checkout.redirectUrl,
  });
}

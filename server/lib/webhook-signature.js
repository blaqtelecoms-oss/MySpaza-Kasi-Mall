// Standard Webhooks signature verification.
//
// Both providers sign the raw request body with HMAC-SHA256 over
// `${id}.${timestamp}.${body}` and send the base64 digest in a signature
// header. Resend uses Svix header names (`svix-id`, …); Supabase auth hooks use
// the standard ones (`webhook-id`, …) — callers pass whichever they received.
//
// The signing secret is base64, optionally prefixed with `whsec_` and/or `v1,`
// (Supabase shows it as `v1,whsec_<base64>`).
import { createHmac, timingSafeEqual } from "node:crypto";

// Reject replayed requests older than this (Resend/Supabase retries stay well
// inside the window).
const TOLERANCE_SECONDS = 5 * 60;

function signingKey(secret) {
  const withoutVersion = String(secret).trim().replace(/^v1,/, "");
  const base64 = withoutVersion.startsWith("whsec_")
    ? withoutVersion.slice("whsec_".length)
    : withoutVersion;
  return Buffer.from(base64, "base64");
}

export function verifyWebhookSignature({
  secret,
  payload,
  id,
  timestamp,
  signature,
  now = Date.now(),
}) {
  if (!secret) return { ok: false, status: 503, reason: "Webhook signing secret is not configured" };
  if (!id || !timestamp || !signature) {
    return { ok: false, status: 401, reason: "Missing signature headers" };
  }

  const age = Math.abs(now / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) {
    return { ok: false, status: 401, reason: "Stale webhook signature" };
  }

  const expected = createHmac("sha256", signingKey(secret))
    .update(`${id}.${timestamp}.${payload}`)
    .digest();

  for (const entry of String(signature).split(" ")) {
    const [version, value] = entry.split(",");
    if (version !== "v1" || !value) continue;
    const given = Buffer.from(value, "base64");
    if (given.length === expected.length && timingSafeEqual(given, expected)) {
      return { ok: true };
    }
  }

  return { ok: false, status: 401, reason: "Invalid webhook signature" };
}

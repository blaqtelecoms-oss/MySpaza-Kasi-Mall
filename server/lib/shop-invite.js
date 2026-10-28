// Creating a shop invitation.
//
// Called by the owner's browser (through the app's own /api path) with the
// Supabase access token. The shop is the caller's own account, so an owner can
// only ever invite for their own shop — the shop id is never taken from the
// request body.
//
// The invitation is stored as a SHA-256 hash of a random token; the raw token
// only travels inside the Resend email link. Acceptance happens in
// `public.accept_shop_invite()`, which checks the signed-in address matches.
import { createHash, randomBytes } from "node:crypto";
import { sendEmployeeInvite } from "./invite-email.js";
import { resendConfigured } from "./resend.js";
import {
  deleteRows,
  insertRow,
  selectRows,
  supabaseBaseUrl,
  supabaseRestConfigured,
} from "./supabase-rest.js";
import { isEmail, sanitisePermissions, sanitiseRole } from "./modules.js";

const INVITE_TTL_DAYS = 7;

function publicKey() {
  return (
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  );
}

/** Resolve the caller from their Supabase access token. */
async function authenticate(authorization) {
  const token = String(authorization || "").replace(/^Bearer\s+/i, "").trim();
  const base = supabaseBaseUrl();
  const key = publicKey();
  if (!token || !base || !key) return null;

  const response = await fetch(`${base}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;

  const user = await response.json().catch(() => null);
  if (!user?.id) return null;
  return { id: user.id, email: user.email, fullName: user.user_metadata?.full_name };
}

async function profileName(shopId) {
  try {
    const rows = await selectRows(
      "profiles",
      `select=full_name,email&id=eq.${encodeURIComponent(shopId)}&limit=1`
    );
    return rows?.[0]?.full_name || rows?.[0]?.email || null;
  } catch {
    return null;
  }
}

async function shopNameFor(shopId) {
  try {
    const rows = await selectRows(
      "shop_settings",
      `select=business&created_by_id=eq.${encodeURIComponent(shopId)}&limit=1`
    );
    const name = rows?.[0]?.business?.name?.trim();
    if (name) return name;
  } catch {
    /* fall back to the owner's profile name */
  }
  return (await profileName(shopId)) || "a My Spaza shop";
}

/** Where the invitation link points: the deployed app, or the preview origin. */
function appUrl(headers) {
  const configured = (process.env.APP_URL || "").replace(/\/+$/, "");
  if (configured) return configured;
  const origin = String(headers?.origin || "");
  return /^https?:\/\//.test(origin) ? origin.replace(/\/+$/, "") : "";
}

export async function handleCreateShopInvite({ rawBody, headers, respond }) {
  if (!resendConfigured()) {
    return respond(503, { error: "Email is not configured (RESEND_API_KEY is missing)." });
  }
  if (!supabaseRestConfigured()) {
    return respond(503, { error: "Supabase is not configured on the email service." });
  }

  const caller = await authenticate(headers.authorization);
  if (!caller) return respond(401, { error: "Sign in to invite employees." });

  let body;
  try {
    body = JSON.parse(rawBody || "{}");
  } catch {
    return respond(400, { error: "Invalid JSON body" });
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!isEmail(email)) return respond(400, { error: "Enter a valid email address." });
  if (email === String(caller.email || "").toLowerCase()) {
    return respond(400, { error: "You cannot invite your own account." });
  }

  const permissions = sanitisePermissions(body.permissions);
  if (Object.keys(permissions).length === 0) {
    return respond(400, { error: "Choose at least one module for this employee." });
  }
  const role = sanitiseRole(body.role);

  const base = appUrl(headers);
  if (!base) {
    return respond(503, { error: "Invitation links need APP_URL set on the email service." });
  }

  const existing = await selectRows(
    "shop_member",
    `select=id&shop_id=eq.${encodeURIComponent(caller.id)}&member_email=eq.${encodeURIComponent(email)}&limit=1`
  );
  if (existing?.length) {
    return respond(409, { error: "That email already has access to this shop." });
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // A re-invite replaces the previous open link: the database allows only one
  // open invitation per address, so the old one is removed first.
  await deleteRows(
    "shop_invite",
    `shop_id=eq.${encodeURIComponent(caller.id)}&email=eq.${encodeURIComponent(email)}&accepted_at=is.null`
  );

  await insertRow("shop_invite", {
    id: randomBytes(9).toString("hex"),
    shop_id: caller.id,
    email,
    role,
    permissions,
    token_hash: tokenHash,
    expires_at: expiresAt,
    invited_by_id: caller.id,
  });

  const shopName = await shopNameFor(caller.id);
  const inviterName = caller.fullName || (await profileName(caller.id)) || caller.email;

  try {
    await sendEmployeeInvite({
      to: email,
      shopName,
      inviterName,
      role,
      permissions,
      acceptUrl: `${base}/invite/${token}`,
      expiresAt,
    });
  } catch (error) {
    return respond(502, {
      error: `Invitation saved, but Resend could not deliver the email: ${error.message}`,
    });
  }

  return respond(201, { ok: true, email, role, permissions, expires_at: expiresAt });
}

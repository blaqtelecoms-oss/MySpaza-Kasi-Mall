// Shared plumbing for the two invitation emails — a shop employee invitation
// and a community group invitation. Both are sent by the owner's browser
// through an API route, verify the caller's Supabase session, and store only a
// hash of the token that travels inside the email link.
import { selectRows, supabaseBaseUrl } from "./supabase-rest.js";

export const INVITE_TTL_DAYS = 7;

/** Used when a shop has not saved a business name yet. */
export const UNNAMED_SHOP = "a My Spaza shop";

function publicKey() {
  return (
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  );
}

/** Resolve the caller from their Supabase access token. */
export async function authenticate(authorization) {
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

export async function profileName(shopId) {
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

export async function shopNameFor(shopId) {
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
  return (await profileName(shopId)) || UNNAMED_SHOP;
}

/**
 * Which shop an invitation belongs to: the caller's own account, or one of the
 * branches they own. The id is never taken on trust — the `shop` row has to
 * name the caller as its owner.
 */
export async function resolveShop(caller, requested) {
  const shopId = String(requested || "").trim();
  if (!shopId || shopId === caller.id) return caller.id;
  try {
    const rows = await selectRows(
      "shop",
      `select=id,owner_id&id=eq.${encodeURIComponent(shopId)}&limit=1`
    );
    return rows?.[0]?.owner_id === caller.id ? shopId : null;
  } catch {
    return null;
  }
}

/** Where the invitation link points: the deployed app, or the preview origin. */
export function appUrl(headers) {
  const configured = (process.env.APP_URL || "").replace(/\/+$/, "");
  if (configured) return configured;
  const origin = String(headers?.origin || "");
  return /^https?:\/\//.test(origin) ? origin.replace(/\/+$/, "") : "";
}

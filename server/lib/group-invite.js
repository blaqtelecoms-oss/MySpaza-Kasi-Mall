// Inviting someone to one of the owner's community groups: a stokvel savings
// account, a savings group or a bulk buy order.
//
// Same shape as the employee invitation: the owner's Supabase session is
// verified here, the shop is the caller's own account (or a branch they own),
// and the group has to belong to that shop before a link is created. Only the
// SHA-256 hash of the token is stored; acceptance happens in
// `public.accept_group_invite()`, which adds the signed-in account to the
// group's member list after checking the address matches.
import { createHash, randomBytes } from "node:crypto";
import { sendGroupInvite } from "./group-invite-email.js";
import { resendConfigured } from "./resend.js";
import { deleteRows, insertRow, selectRows, supabaseRestConfigured } from "./supabase-rest.js";
import {
  appUrl,
  authenticate,
  INVITE_TTL_DAYS,
  profileName,
  resolveShop,
  shopNameFor,
  UNNAMED_SHOP,
} from "./invite-core.js";
import { isEmail } from "./modules.js";

/**
 * The tables a group can live in. `nameColumn` is the field the invitee sees;
 * a stokvel has no name of its own, so its label is built from the shop.
 */
const GROUPS = {
  stokvel: { table: "stockfell_account", nameColumn: "name", fallback: "Stokvel" },
  savings_group: { table: "savings_group", nameColumn: "name", fallback: "Savings group" },
  bulk_buy: { table: "bulk_buy", nameColumn: "title", fallback: "Bulk buy" },
};

function enc(value) {
  return encodeURIComponent(String(value));
}

/** The group row, only when it belongs to the shop the caller owns. */
async function resolveGroup(config, groupId, shopId) {
  const columns = config.nameColumn ? `id,${config.nameColumn}` : "id";
  try {
    const rows = await selectRows(
      config.table,
      `select=${columns}&id=eq.${enc(groupId)}&created_by_id=eq.${enc(shopId)}&limit=1`
    );
    return rows?.[0] || null;
  } catch {
    return null;
  }
}

export async function handleCreateGroupInvite({ rawBody, headers, respond }) {
  if (!resendConfigured()) {
    return respond(503, { error: "Email is not configured (RESEND_API_KEY is missing)." });
  }
  if (!supabaseRestConfigured()) {
    return respond(503, { error: "Supabase is not configured on the email service." });
  }

  const caller = await authenticate(headers.authorization);
  if (!caller) return respond(401, { error: "Sign in to invite people to your group." });

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

  const groupKind = String(body.groupKind || "").trim();
  const config = GROUPS[groupKind];
  if (!config) {
    return respond(400, { error: "Choose a stokvel, savings group or bulk buy to invite to." });
  }

  const groupId = String(body.groupId || "").trim();
  if (!groupId) return respond(400, { error: "Choose which group to invite them to." });

  const shopId = await resolveShop(caller, body.shopId);
  if (!shopId) {
    return respond(403, { error: "You can only invite people to a group in a shop you own." });
  }

  const group = await resolveGroup(config, groupId, shopId);
  if (!group) return respond(404, { error: "That group is no longer available." });

  const base = appUrl(headers);
  if (!base) {
    return respond(503, { error: "Invitation links need APP_URL set on the email service." });
  }

  const shopName = await shopNameFor(shopId);
  const stokvelLabel = shopName === UNNAMED_SHOP ? "Stokvel" : `${shopName} stokvel`;
  const groupName =
    (config.nameColumn && String(group[config.nameColumn] || "").trim()) ||
    (groupKind === "stokvel" ? stokvelLabel : config.fallback);

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Resending replaces the previous open link for this address and group — the
  // database allows only one, so the old token stops working.
  await deleteRows(
    "group_invite",
    `shop_id=eq.${enc(shopId)}&group_kind=eq.${enc(groupKind)}&group_id=eq.${enc(groupId)}` +
      `&email=eq.${enc(email)}&accepted_at=is.null`
  );

  await insertRow("group_invite", {
    id: randomBytes(9).toString("hex"),
    shop_id: shopId,
    group_kind: groupKind,
    group_id: groupId,
    group_name: groupName,
    email,
    token_hash: tokenHash,
    expires_at: expiresAt,
    invited_by_id: caller.id,
  });

  const inviterName = caller.fullName || (await profileName(caller.id)) || caller.email;

  try {
    await sendGroupInvite({
      to: email,
      groupKind,
      groupName,
      shopName,
      inviterName,
      acceptUrl: `${base}/invite/group/${token}`,
      expiresAt,
    });
  } catch (error) {
    return respond(502, {
      error: `Invitation saved, but Resend could not deliver the email: ${error.message}`,
    });
  }

  return respond(201, { ok: true, email, group_kind: groupKind, group_name: groupName, expires_at: expiresAt });
}

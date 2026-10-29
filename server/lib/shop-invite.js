// Creating a shop invitation.
//
// Called by the owner's browser (through the app's own /api path) with the
// Supabase access token. The shop is the caller's own account, so an owner can
// only ever invite for their own shop — the shop id is never taken from the
// request body.
//
// The invitation is stored as a SHA-256 hash of a random token; the raw token
// only travels inside the Resend email link. Acceptance happens in
// `public.accept_shop_invite()`, which checks the signed-in address matches and
// copies the employee's name and monthly salary onto the membership.
import { createHash, randomBytes } from "node:crypto";
import { sendEmployeeInvite } from "./invite-email.js";
import { resendConfigured } from "./resend.js";
import { deleteRows, insertRow, selectRows, supabaseRestConfigured } from "./supabase-rest.js";
import {
  appUrl,
  authenticate,
  INVITE_TTL_DAYS,
  profileName,
  resolveShop,
  shopNameFor,
} from "./invite-core.js";
import { isEmail, sanitiseFullName, sanitisePermissions, sanitiseRole, sanitiseSalary } from "./modules.js";

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

  const fullName = sanitiseFullName(body.fullName);
  if (!fullName) return respond(400, { error: "Enter the employee's name." });

  const monthlySalary = sanitiseSalary(body.monthlySalary);
  if (Number.isNaN(monthlySalary)) {
    return respond(400, { error: "Enter the monthly salary as a number of rand." });
  }

  const permissions = sanitisePermissions(body.permissions);
  if (Object.keys(permissions).length === 0) {
    return respond(400, { error: "Choose at least one module for this employee." });
  }
  const role = sanitiseRole(body.role);

  const shopId = await resolveShop(caller, body.shopId);
  if (!shopId) {
    return respond(403, { error: "You can only invite employees to a shop you own." });
  }

  const base = appUrl(headers);
  if (!base) {
    return respond(503, { error: "Invitation links need APP_URL set on the email service." });
  }

  const existing = await selectRows(
    "shop_member",
    `select=id&shop_id=eq.${encodeURIComponent(shopId)}&member_email=eq.${encodeURIComponent(email)}&limit=1`
  );
  if (existing?.length) {
    return respond(409, { error: "That email already has access to this shop." });
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // A re-invite replaces the previous open link: the database allows only one
  // open invitation per address, so the old one is removed first. Sending it
  // again is also how an owner resends an invitation that went astray.
  await deleteRows(
    "shop_invite",
    `shop_id=eq.${encodeURIComponent(shopId)}&email=eq.${encodeURIComponent(email)}&accepted_at=is.null`
  );

  await insertRow("shop_invite", {
    id: randomBytes(9).toString("hex"),
    shop_id: shopId,
    email,
    full_name: fullName,
    monthly_salary: monthlySalary,
    role,
    permissions,
    token_hash: tokenHash,
    expires_at: expiresAt,
    invited_by_id: caller.id,
  });

  const shopName = await shopNameFor(shopId);
  const inviterName = caller.fullName || (await profileName(caller.id)) || caller.email;

  try {
    await sendEmployeeInvite({
      to: email,
      shopName,
      inviterName,
      fullName,
      monthlySalary,
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

  return respond(201, {
    ok: true,
    email,
    full_name: fullName,
    monthly_salary: monthlySalary,
    role,
    permissions,
    expires_at: expiresAt,
  });
}

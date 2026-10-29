// Group invitation email, sent through Resend.
//
// One template for all three kinds of group an owner runs — a stokvel savings
// account, a savings group and a bulk buy order — so an invitee sees the same
// clear call to action whichever tab they were invited from.
import { sendEmail } from "./resend.js";

const KIND_LABELS = {
  stokvel: "stokvel",
  savings_group: "savings group",
  bulk_buy: "bulk buy",
};

const KIND_INVITE_LINES = {
  stokvel: "You can follow the stokvel balance and your contributions once you join.",
  savings_group: "You can see the group's target, contributions and members once you join.",
  bulk_buy: "You can see the order, the shared price per member and your share once you join.",
};

export function groupKindLabel(kind) {
  return KIND_LABELS[kind] || "group";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderGroupInvite({ groupKind, groupName, shopName, inviterName, acceptUrl, expiresAt }) {
  const label = groupKindLabel(groupKind);
  const expiry = new Date(expiresAt).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const safeGroup = escapeHtml(groupName);
  const safeShop = escapeHtml(shopName);
  const safeInviter = escapeHtml(inviterName || "The shop owner");
  const detail = KIND_INVITE_LINES[groupKind] || "You can see the group once you join.";

  return {
    subject: `${safeInviter} invited you to the ${label} ${safeGroup} on My Spaza`,
    text: [
      `${inviterName || "The shop owner"} invited you to join the ${label} "${groupName}" from ${shopName} on My Spaza.`,
      "",
      detail,
      "",
      `Accept the invitation: ${acceptUrl}`,
      "",
      `This link works once and expires on ${expiry}.`,
    ].join("\n"),
    html: `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f9f9f9;padding:24px">
        <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px;border:1px solid #ececec">
          <p style="margin:0 0 18px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#0f766e;font-weight:700">My Spaza</p>
          <h1 style="margin:0 0 12px;font-size:22px;color:#111">Join ${safeGroup}</h1>
          <p style="margin:0 0 18px;font-size:15px;color:#444;line-height:1.55">
            ${safeInviter} invited you to the <strong>${escapeHtml(label)}</strong> “${safeGroup}”
            at ${safeShop} on My Spaza.
          </p>
          <p style="margin:0 0 22px;font-size:14px;color:#444;line-height:1.55">${escapeHtml(detail)}</p>
          <a href="${escapeHtml(acceptUrl)}"
             style="display:inline-block;background:#27ae60;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 22px;border-radius:10px">
            Accept invitation
          </a>
          <p style="margin:22px 0 0;font-size:12px;color:#888;line-height:1.6">
            This link works once and expires on ${escapeHtml(expiry)}. If you weren't expecting it, you can ignore this email.
          </p>
        </div>
      </div>
    `,
  };
}

/** Send the invitation. Throws with the provider message on failure. */
export async function sendGroupInvite(payload) {
  const message = renderGroupInvite(payload);
  return sendEmail({ to: payload.to, subject: message.subject, html: message.html, text: message.text });
}

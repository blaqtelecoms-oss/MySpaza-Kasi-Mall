// Employee invitation email, sent through Resend.
import { sendEmail } from "./resend.js";

const MODULE_LABELS = {
  pos: "Point of Sale",
  inventory: "Inventory",
  cashup: "Cash Up",
  daily_sales: "Daily Sales",
  banking: "Banking",
  accounting: "Accounting",
  expenses: "Expenses",
  suppliers: "Suppliers",
  customers: "Customers",
  debtors: "Debtors Control",
  reports: "Reports",
  academy: "Academy",
  calculators: "Calculators",
  coach: "Spaza Coach",
  funding: "Funding Hub",
  myspaza_card: "MySpaza Card",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderEmployeeInvite({ shopName, inviterName, role, permissions, acceptUrl, expiresAt }) {
  const modules = Object.entries(permissions || {})
    .map(([key, level]) => `${MODULE_LABELS[key] || key} (${level === "edit" ? "can edit" : "view only"})`)
    .join(", ");
  const expiry = new Date(expiresAt).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const safeShop = escapeHtml(shopName);
  const safeInviter = escapeHtml(inviterName || "The shop owner");

  return {
    subject: `${safeInviter} invited you to ${safeShop} on My Spaza`,
    text: [
      `${inviterName || "The shop owner"} invited you to join ${shopName} on My Spaza.`,
      "",
      `Role: ${role}`,
      `Access: ${modules || "No modules selected"}`,
      "",
      `Accept the invitation and set up your account: ${acceptUrl}`,
      "",
      `This link can be used once and expires on ${expiry}.`,
    ].join("\n"),
    html: `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f9f9f9;padding:24px">
        <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px;border:1px solid #ececec">
          <p style="margin:0 0 18px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#0f766e;font-weight:700">My Spaza</p>
          <h1 style="margin:0 0 12px;font-size:22px;color:#111">You're invited to ${safeShop}</h1>
          <p style="margin:0 0 18px;font-size:15px;color:#444;line-height:1.55">
            ${safeInviter} added you to their My Spaza shop as <strong>${escapeHtml(role)}</strong>.
            Once you accept, the shop and your role appear after you sign in.
          </p>
          <p style="margin:0 0 6px;font-size:13px;color:#666;font-weight:600">What you can access</p>
          <p style="margin:0 0 22px;font-size:14px;color:#444;line-height:1.55">${escapeHtml(modules || "No modules selected")}</p>
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
export async function sendEmployeeInvite(payload) {
  const message = renderEmployeeInvite(payload);
  return sendEmail({ to: payload.to, subject: message.subject, html: message.html, text: message.text });
}

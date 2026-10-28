// Auth emails rendered for the Supabase "Send Email" hook.
//
// Every Supabase auth email goes through this template, so the copy covers all
// action types. The verification code is never persisted anywhere — it only
// lives in this rendered message.
const APP_NAME = "My Spaza";

const COPY = {
  signup: {
    subject: "Your My Spaza verification code",
    heading: "Confirm your email address",
    intro: `Use the code below to finish creating your ${APP_NAME} account. It expires in one hour.`,
    button: null,
  },
  invite: {
    subject: "You're invited to My Spaza",
    heading: "You've been invited",
    intro: `Use the code below, or the button, to accept your ${APP_NAME} invitation.`,
    button: "Accept invitation",
  },
  magiclink: {
    subject: "Your My Spaza sign-in link",
    heading: "Sign in to My Spaza",
    intro: "Use the button below to sign in. You can enter the code instead if you prefer.",
    button: "Sign in",
  },
  recovery: {
    subject: "Reset your My Spaza password",
    heading: "Reset your password",
    intro: "Use the button below to choose a new password. The code works too.",
    button: "Reset password",
  },
  email_change: {
    subject: "Confirm your new email address",
    heading: "Confirm your email change",
    intro: `Use the code below to confirm this address for your ${APP_NAME} account.`,
    button: null,
  },
  reauthentication: {
    subject: "Your My Spaza verification code",
    heading: "Confirm it's you",
    intro: "Use the code below to continue.",
    button: null,
  },
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function copyFor(actionType) {
  return COPY[actionType] || COPY.signup;
}

export function renderAuthEmail({ actionType, code, link }) {
  const copy = copyFor(actionType);
  const safeCode = escapeHtml(code);
  const safeLink = escapeHtml(link || "");

  const codeBlock = code
    ? `
      <div style="margin:24px 0;padding:18px 12px;border-radius:12px;background:#FFF8DB;border:1px solid #FFD426;text-align:center">
        <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280">Verification code</p>
        <p style="margin:0;font-size:32px;font-weight:700;letter-spacing:0.28em;color:#0D0D0D;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${safeCode}</p>
      </div>`
    : "";

  const buttonBlock =
    link && copy.button
      ? `<div style="margin:24px 0"><a href="${safeLink}" style="display:inline-block;background:#0D0D0D;color:#FFD426;text-decoration:none;font-weight:600;padding:14px 22px;border-radius:10px">${escapeHtml(copy.button)}</a></div>`
      : "";

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f5f6f3">
    <div style="padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
        <div style="background:#0D0D0D;padding:22px;text-align:center">
          <span style="color:#FFD426;font-size:18px;font-weight:700;letter-spacing:0.02em">${APP_NAME}</span>
        </div>
        <div style="padding:28px">
          <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#0D0D0D">${escapeHtml(copy.heading)}</h1>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#374151">${escapeHtml(copy.intro)}</p>
          ${codeBlock}
          ${buttonBlock}
          <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6b7280">
            If you didn't request this email you can safely ignore it — nobody can access your account without the code.
          </p>
        </div>
        <div style="padding:18px 28px;border-top:1px solid #e5e7eb;background:#fafafa">
          <p style="margin:0;font-size:12px;color:#9ca3af">${APP_NAME} · Spaza shop management</p>
        </div>
      </div>
    </div>
  </body>
</html>`;

  const textLines = [copy.heading, "", copy.intro, ""];
  if (code) textLines.push(`Verification code: ${code}`, "");
  if (link && copy.button) textLines.push(`${copy.button}: ${link}`, "");
  textLines.push("If you didn't request this email you can safely ignore it.");

  return {
    subject: copy.subject,
    html,
    text: textLines.join("\n"),
  };
}

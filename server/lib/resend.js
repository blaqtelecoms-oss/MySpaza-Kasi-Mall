// Resend send API client (plain fetch, no SDK).
const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function resendConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export function senderAddress() {
  return process.env.RESEND_FROM_EMAIL || "noreply@myspaza-app.co.za";
}

export function senderHeader() {
  const name = process.env.RESEND_FROM_NAME || "My Spaza";
  return `${name} <${senderAddress()}>`;
}

/**
 * Send one email through Resend. Throws with the provider's message so the
 * caller can report a failure it can retry; the API key never leaves this
 * process and is never included in the error.
 */
export async function sendEmail({ to, subject, html, text }) {
  if (!resendConfigured()) {
    throw new Error("Resend is not configured: set RESEND_API_KEY");
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: senderHeader(),
      to: [to],
      subject,
      html,
      text,
    }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body?.message || `Resend rejected the email (HTTP ${response.status})`);
  }

  return { id: body.id };
}

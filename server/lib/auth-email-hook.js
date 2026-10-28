// Supabase "Send Email" auth hook.
//
// Supabase posts the verification code it generated here instead of sending its
// own email; we deliver it through Resend from RESEND_FROM_EMAIL. Signature
// rules: https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
import { verifyWebhookSignature } from "./webhook-signature.js";
import { sendEmail, senderAddress, resendConfigured } from "./resend.js";
import { renderAuthEmail } from "./email-templates.js";
import {
  insertRow,
  supabaseBaseUrl,
  supabaseRestConfigured,
} from "./supabase-rest.js";

/** Link Supabase's own verify endpoint hands back to the app after a click. */
function verifyLink({ tokenHash, actionType, redirectTo }) {
  const baseUrl = supabaseBaseUrl();
  if (!baseUrl || !tokenHash) return null;

  const url = new URL(`${baseUrl}/auth/v1/verify`);
  url.searchParams.set("token", tokenHash);
  url.searchParams.set("type", actionType);
  if (redirectTo) url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

/**
 * One message per address. A secure email change generates two codes: one for
 * the current address and one for the new one. Supabase's token/hash field
 * names are reversed for backwards compatibility, so `token_hash_new` pairs
 * with `token` (current address) and `token_hash` with `token_new` (new one).
 */
function buildMessages(payload) {
  const emailData = payload?.email_data ?? {};
  const user = payload?.user ?? {};
  const actionType = emailData.email_action_type || "signup";
  const redirectTo = emailData.redirect_to;

  if (actionType === "email_change" && emailData.token_new && emailData.token_hash_new) {
    return [
      {
        actionType,
        redirectTo,
        to: user.email,
        code: emailData.token,
        tokenHash: emailData.token_hash_new,
      },
      {
        actionType,
        redirectTo,
        to: user.new_email,
        code: emailData.token_new,
        tokenHash: emailData.token_hash,
      },
    ];
  }

  if (actionType === "email_change") {
    return [
      {
        actionType,
        redirectTo,
        to: user.new_email || user.email,
        code: emailData.token || emailData.token_new,
        tokenHash: emailData.token_hash,
      },
    ];
  }

  return [
    {
      actionType,
      redirectTo,
      to: user.email,
      code: emailData.token,
      tokenHash: emailData.token_hash,
    },
  ];
}

/** Best-effort log of what we handed to Resend; never blocks the delivery. */
async function recordSubmitted({ message, subject, providerId }) {
  if (!supabaseRestConfigured()) return;
  try {
    await insertRow(
      "email_event",
      {
        provider_event_id: `resend:${providerId}`,
        event_type: "submitted",
        resend_email_id: providerId,
        recipient_email: message.to,
        sender_email: senderAddress(),
        subject,
        template: message.actionType,
        event_created_at: new Date().toISOString(),
        payload: { email_action_type: message.actionType, source: "supabase-auth-hook" },
      },
      { onConflict: "provider_event_id" }
    );
  } catch (error) {
    console.warn(`[send-email] event log skipped: ${error.message}`);
  }
}

export async function handleAuthEmailHook({ rawBody, headers, respond }) {
  const verification = verifyWebhookSignature({
    secret: process.env.SUPABASE_SEND_EMAIL_HOOK_SECRET,
    payload: rawBody,
    id: headers["webhook-id"] || headers["svix-id"],
    timestamp: headers["webhook-timestamp"] || headers["svix-timestamp"],
    signature: headers["webhook-signature"] || headers["svix-signature"],
  });
  if (!verification.ok) {
    return respond(verification.status, { error: { message: verification.reason } });
  }

  if (!resendConfigured()) {
    return respond(503, {
      error: { message: "Resend is not configured on the email service (RESEND_API_KEY)." },
    });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return respond(400, { error: { message: "Invalid JSON body" } });
  }

  const messages = buildMessages(payload).filter((message) => message.to && message.code);
  if (messages.length === 0) {
    return respond(400, {
      error: { message: "Hook payload did not include an email address and token." },
    });
  }

  for (const message of messages) {
    const email = renderAuthEmail({
      actionType: message.actionType,
      code: message.code,
      link: verifyLink(message),
    });

    let sent;
    try {
      sent = await sendEmail({
        to: message.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
    } catch (error) {
      console.error(`[send-email] ${message.actionType} delivery failed: ${error.message}`);
      return respond(502, { error: { message: error.message } });
    }

    await recordSubmitted({ message, subject: email.subject, providerId: sent.id });
  }

  return respond(200, {});
}

// Resend delivery webhook.
//
// Stores every event Resend sends (email.sent, email.delivered,
// email.delivery_delayed, email.bounced, email.complained, email.opened,
// email.clicked, …) in public.email_event. `svix-id` is unique per delivery
// attempt, so provider retries collapse onto the same row instead of
// duplicating history.
import { verifyWebhookSignature } from "./webhook-signature.js";
import { insertRow, supabaseRestConfigured } from "./supabase-rest.js";

export async function handleResendWebhook({ rawBody, headers, respond }) {
  const eventId = headers["svix-id"];

  const verification = verifyWebhookSignature({
    secret: process.env.RESEND_WEBHOOK_SECRET,
    payload: rawBody,
    id: eventId,
    timestamp: headers["svix-timestamp"],
    signature: headers["svix-signature"],
  });
  if (!verification.ok) {
    return respond(verification.status, { error: verification.reason });
  }

  if (!supabaseRestConfigured()) {
    return respond(503, { error: "Supabase is not configured on the email service." });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return respond(400, { error: "Invalid JSON body" });
  }

  const { type, created_at: createdAt, data = {} } = event ?? {};
  if (!type) return respond(400, { error: "Missing event type" });

  const recipients = Array.isArray(data.to) ? data.to : [data.to];

  try {
    await insertRow(
      "email_event",
      {
        provider_event_id: eventId,
        event_type: type,
        resend_email_id: data.email_id || null,
        recipient_email: recipients[0] || null,
        sender_email: data.from || null,
        subject: data.subject || null,
        event_created_at: createdAt || data.created_at || null,
        payload: data,
      },
      { onConflict: "provider_event_id" }
    );
  } catch (error) {
    // A non-2xx makes Resend retry, which is what we want while storage is down.
    console.error(`[resend-webhook] ${error.message}`);
    return respond(500, { error: "Could not record the event" });
  }

  return respond(200, { ok: true });
}

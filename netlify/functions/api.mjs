// Netlify Function serving the app's own /api endpoints on the public domain.
//
// In the sandbox these run in the small email service (server/index.js) and the
// Vite dev server proxies /api to it. A static deploy has no such server, so
// this function hands the same request to the same handlers: preview and
// production behave identically.
//
// public/_redirects sends /api/* here, keeping the path after /api:
//   /api/invitations               -> /.netlify/functions/api/invitations
//   /api/webhooks/resend           -> /.netlify/functions/api/webhooks/resend
//   /api/hooks/supabase/send-email -> /.netlify/functions/api/hooks/supabase/send-email
//
// Request bodies (verification codes) are never logged here either.
import { handleAuthEmailHook } from "../../server/lib/auth-email-hook.js";
import { handleResendWebhook } from "../../server/lib/resend-webhook.js";
import { handleCreateShopInvite } from "../../server/lib/shop-invite.js";
import { handleCreateGroupInvite } from "../../server/lib/group-invite.js";
import { handleCreateCheckout } from "../../server/lib/billing-checkout.js";
import { handleYocoWebhook } from "../../server/lib/yoco-webhook.js";
import { resendConfigured, senderAddress } from "../../server/lib/resend.js";
import { supabaseRestConfigured } from "../../server/lib/supabase-rest.js";
import { yocoConfigured, yocoWebhookConfigured } from "../../server/lib/yoco.js";

const routes = {
  "/api/hooks/supabase/send-email": handleAuthEmailHook,
  "/api/webhooks/resend": handleResendWebhook,
  "/api/invitations": handleCreateShopInvite,
  "/api/group-invitations": handleCreateGroupInvite,
  "/api/billing/checkout": handleCreateCheckout,
  "/api/webhooks/yoco": handleYocoWebhook,
};

const FUNCTION_PREFIX = "/.netlify/functions/api";

function json(status, body) {
  return new Response(JSON.stringify(body ?? {}), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async (request) => {
  // The function is reached through a rewrite, and Netlify may hand it either
  // the original path or the rewritten one — map both back onto the routes.
  const { pathname } = new URL(request.url);
  const apiPath = pathname.startsWith(FUNCTION_PREFIX)
    ? `/api${pathname.slice(FUNCTION_PREFIX.length)}`
    : pathname;
  const path = apiPath.replace(/\/+$/, "") || "/";

  if (request.method === "GET" && path === "/health") {
    return json(200, {
      ok: true,
      resend: resendConfigured(),
      from: senderAddress(),
      storage: supabaseRestConfigured(),
      yoco: yocoConfigured(),
      yoco_webhook: yocoWebhookConfigured(),
    });
  }

  const handler = routes[path];
  if (!handler) return json(404, { error: "Not found" });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });

  let response = { status: 500, body: { error: "Unexpected error" } };
  const respond = (status, body) => {
    response = { status, body };
  };

  try {
    await handler({
      rawBody: await request.text(),
      headers: Object.fromEntries(request.headers),
      respond,
    });
  } catch (error) {
    console.error(`[${path}] unhandled error: ${error.message}`);
    return json(500, { error: "Unexpected error" });
  }

  return json(response.status, response.body);
};

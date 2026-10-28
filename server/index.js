// Resend email service for My Spaza.
//
// Endpoints (all server-to-server, no browser session):
//   GET  /health                         liveness for the compose healthcheck
//   POST /api/hooks/supabase/send-email  Supabase "Send Email" auth hook: renders
//                                        the signup/recovery code and sends it
//                                        through Resend.
//   POST /api/webhooks/resend            Resend delivery events, stored in
//                                        public.email_event for the operator log.
//
// Both POST routes verify the Standard Webhooks signature over the raw body, so
// they are safe to expose. No dependencies: node:http plus global fetch.
//
// Request bodies are never logged: they carry verification codes.
import http from "node:http";
import { handleAuthEmailHook } from "./lib/auth-email-hook.js";
import { handleResendWebhook } from "./lib/resend-webhook.js";
import { resendConfigured, senderAddress } from "./lib/resend.js";
import { supabaseRestConfigured } from "./lib/supabase-rest.js";

const PORT = Number(process.env.PORT || 8080);
const MAX_BODY_BYTES = 256 * 1024;

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res, status, body) {
  const payload = JSON.stringify(body ?? {});
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

const routes = {
  "/api/hooks/supabase/send-email": handleAuthEmailHook,
  "/api/webhooks/resend": handleResendWebhook,
};

const server = http.createServer(async (req, res) => {
  const path = (req.url || "/").split("?")[0].replace(/\/+$/, "") || "/";

  if (req.method === "GET" && path === "/health") {
    return json(res, 200, {
      ok: true,
      resend: resendConfigured(),
      from: senderAddress(),
      storage: supabaseRestConfigured(),
    });
  }

  const handler = routes[path];
  if (!handler) return json(res, 404, { error: "Not found" });
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (error) {
    return json(res, 413, { error: error.message });
  }

  try {
    await handler({
      rawBody,
      headers: req.headers,
      respond: (status, body) => json(res, status, body),
    });
  } catch (error) {
    console.error(`[${path}] unhandled error: ${error.message}`);
    json(res, 500, { error: "Unexpected error" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Email service listening on :${PORT}`);
  console.log(`  resend configured: ${resendConfigured()}`);
  console.log(`  supabase storage configured: ${supabaseRestConfigured()}`);
});

// Minimal PostgREST writer for the email log.
//
// The service role key bypasses row level security, so this module must only
// ever run server-side. It writes to public.email_event; the browser reads that
// table with the signed-in user's session and an admin-only policy.
const baseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export function supabaseBaseUrl() {
  return baseUrl;
}

export function supabaseRestConfigured() {
  return Boolean(baseUrl && serviceRoleKey);
}

/**
 * Insert one row. `onConflict` names the unique column; with duplicate
 * resolution enabled a retried webhook is accepted without a second row.
 */
export async function insertRow(table, row, { onConflict } = {}) {
  if (!supabaseRestConfigured()) {
    throw new Error("Supabase is not configured on the email service");
  }

  const url = `${baseUrl}/rest/v1/${table}${onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : ""}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify(row),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Supabase insert into ${table} failed (${response.status}): ${detail.slice(0, 300)}`
    );
  }
}

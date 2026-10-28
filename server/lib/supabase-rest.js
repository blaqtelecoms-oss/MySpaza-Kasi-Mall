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

function serviceHeaders(extra = {}) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

/** Read rows with a PostgREST query string, e.g. `select=id&shop_id=eq.x`. */
export async function selectRows(table, query = "") {
  if (!supabaseRestConfigured()) {
    throw new Error("Supabase is not configured on the email service");
  }
  const response = await fetch(`${baseUrl}/rest/v1/${table}?${query}`, {
    headers: serviceHeaders(),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Supabase read from ${table} failed (${response.status}): ${detail.slice(0, 300)}`
    );
  }
  return response.json();
}

/** Delete rows matching a PostgREST query string. */
export async function deleteRows(table, query) {
  if (!supabaseRestConfigured()) {
    throw new Error("Supabase is not configured on the email service");
  }
  const response = await fetch(`${baseUrl}/rest/v1/${table}?${query}`, {
    method: "DELETE",
    headers: serviceHeaders({ Prefer: "return=minimal" }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Supabase delete from ${table} failed (${response.status}): ${detail.slice(0, 300)}`
    );
  }
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

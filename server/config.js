/**
 * Runtime configuration for the Base44 -> Supabase migration service.
 *
 * Credentials are delivered by the platform to /run/base44/app.env and are
 * never written to the repository. This module only ever exposes *presence*,
 * never values, so nothing secret can leak into a response or a log line.
 */

function trimUrl(value, fallback = '') {
  return (value || fallback).replace(/\/+$/, '');
}

const supabaseUrl = trimUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);

export const config = {
  port: Number(process.env.MIGRATION_PORT || 8000),
  base44: {
    appId: process.env.BASE44_APP_ID || '',
    adminToken: process.env.BASE44_ADMIN_TOKEN || '',
    // Where the app's data, users and media actually live.
    sourceApiUrl: trimUrl(process.env.BASE44_SOURCE_API_URL, 'https://base44.app'),
    // Where a caller's session token is verified (the sandbox dev backend locally).
    authApiUrl: trimUrl(process.env.BASE44_AUTH_API_URL, 'https://base44.app'),
    entitiesDir: process.env.BASE44_ENTITIES_DIR || 'base44/entities',
  },
  supabase: {
    url: supabaseUrl,
    projectRef:
      process.env.SUPABASE_PROJECT_REF ||
      (supabaseUrl ? new URL(supabaseUrl).hostname.split('.')[0] : ''),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    accessToken: process.env.SUPABASE_ACCESS_TOKEN || '',
  },
  runsDir: process.env.MIGRATION_RUNS_DIR || 'server/.runs',
  batchSize: Number(process.env.MIGRATION_BATCH_SIZE || 200),
  mediaConcurrency: Number(process.env.MIGRATION_MEDIA_CONCURRENCY || 4),
};

/** Presence report only — never the values themselves. */
export function credentialReport() {
  const required = {
    BASE44_APP_ID: config.base44.appId,
    BASE44_ADMIN_TOKEN: config.base44.adminToken,
    SUPABASE_URL: config.supabase.url,
    SUPABASE_SERVICE_ROLE_KEY: config.supabase.serviceRoleKey,
    SUPABASE_ACCESS_TOKEN: config.supabase.accessToken,
  };
  const present = {};
  const missing = [];
  for (const [key, value] of Object.entries(required)) {
    const ok = Boolean(value);
    present[key] = ok;
    if (!ok) missing.push(key);
  }
  return { present, missing, ready: missing.length === 0 };
}

export function assertConfigured() {
  const report = credentialReport();
  if (!report.ready) {
    const error = new Error(`Missing credentials: ${report.missing.join(', ')}`);
    error.status = 503;
    throw error;
  }
}

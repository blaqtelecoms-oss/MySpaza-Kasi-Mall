/**
 * Base44 -> Supabase migration API.
 *
 * Zero-dependency HTTP service: the browser polls it for run progress while it
 * talks to the Base44 app (source) and the Supabase project (target) with the
 * credentials the platform injects at /run/base44/app.env.
 */

import http from 'node:http';
import { config, credentialReport, assertConfigured } from './config.js';
import { loadEntitySchemas } from './lib/entities.js';
import { BUCKETS, mediaFieldsFor } from './lib/buckets.js';
import { Base44Source } from './lib/base44.js';
import { SupabaseTarget } from './lib/supabase.js';
import { RunStore, summarizeRun } from './lib/runs.js';
import { MigrationRunner } from './lib/migration.js';
import { HttpError, request, readBody } from './lib/http.js';

const log = (message) => console.log(`[migration] ${message}`);

const schemas = loadEntitySchemas(config.base44.entitiesDir);
const source = new Base44Source(config.base44);
const target = new SupabaseTarget(config.supabase);
const store = new RunStore(config.runsDir);
const runner = new MigrationRunner({ config, store, source, target, schemas, log });

store.reconcileInterrupted();

/* ------------------------------------------------------------------- auth */

const authCache = new Map();
const AUTH_TTL_MS = 60_000;

async function authenticate(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new HttpError(401, 'Sign in to run a migration.');

  const cached = authCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    if (!cached.user) throw new HttpError(403, 'Administrator access required.');
    return cached.user;
  }

  const response = await request(
    `${config.base44.authApiUrl}/api/apps/${config.base44.appId}/entities/User/me`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-App-Id': config.base44.appId,
      },
      timeoutMs: 15_000,
      retries: 1,
    },
  );
  if (!response.ok) {
    authCache.delete(token);
    throw new HttpError(401, 'Your session could not be verified. Sign in again.');
  }
  const user = await readBody(response);
  const isAdmin = user?.role === 'admin';
  authCache.set(token, { user: isAdmin ? user : null, expiresAt: Date.now() + AUTH_TTL_MS });
  if (!isAdmin) throw new HttpError(403, 'Administrator access required.');
  return user;
}

/* ----------------------------------------------------------------- routes */

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new HttpError(413, 'Request body too large.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.');
  }
}

function statusPayload(viewer) {
  return {
    service: 'base44-supabase-migration',
    viewer: viewer ? { email: viewer.email, role: viewer.role } : null,
    credentials: credentialReport(),
    source: {
      appId: config.base44.appId,
      apiUrl: config.base44.sourceApiUrl,
      entities: schemas.map((schema) => ({
        name: schema.name,
        table: schema.table,
        fields: schema.fields.length,
        mediaFields: mediaFieldsFor(schema.name),
      })),
    },
    target: {
      projectRef: config.supabase.projectRef,
      url: config.supabase.url,
    },
    buckets: BUCKETS,
    activeRunId: runner.activeRunId,
    runs: store.list().map(summarizeRun),
  };
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '') || '/';

  try {
    if (req.method === 'GET' && (path === '/health' || path === '/')) {
      send(res, 200, { status: 'ok', schemas: schemas.length });
      return;
    }

    const viewer = await authenticate(req);

    if (req.method === 'GET' && path === '/status') {
      send(res, 200, statusPayload(viewer));
      return;
    }

    if (req.method === 'GET' && path === '/runs') {
      send(res, 200, { runs: store.list().map(summarizeRun) });
      return;
    }

    if (req.method === 'POST' && (path === '/runs' || path === '/dry-run')) {
      assertConfigured();
      const body = path === '/dry-run' ? {} : await readJson(req);
      const mode = path === '/dry-run' ? 'dry-run' : body.mode === 'dry-run' ? 'dry-run' : 'apply';
      const run = await runner.start({
        mode,
        conflictMode: body.conflictMode === 'overwrite' ? 'overwrite' : 'skip',
      });
      send(res, 202, { run });
      return;
    }

    const retryMatch = path.match(/^\/runs\/([A-Za-z0-9_-]+)\/retry$/);
    if (req.method === 'POST' && retryMatch) {
      assertConfigured();
      const run = await runner.retry(retryMatch[1]);
      send(res, 202, { run });
      return;
    }

    const runMatch = path.match(/^\/runs\/([A-Za-z0-9_-]+)$/);
    if (req.method === 'GET' && runMatch) {
      const run = store.get(runMatch[1]);
      if (!run) throw new HttpError(404, 'Run not found.');
      send(res, 200, { run });
      return;
    }

    throw new HttpError(404, 'Not found');
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) log(`${req.method} ${path} -> ${error.message}`);
    send(res, status, { error: error.message });
  }
});

server.listen(config.port, '0.0.0.0', () => {
  log(`listening on :${config.port} · ${schemas.length} entities · project ${config.supabase.projectRef || 'unconfigured'}`);
  const report = credentialReport();
  if (!report.ready) log(`waiting on credentials: ${report.missing.join(', ')}`);
});

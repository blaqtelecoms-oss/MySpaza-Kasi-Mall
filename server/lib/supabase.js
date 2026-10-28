/** Target adapter: Postgres DDL (Management API), data (PostgREST), storage, auth. */

import crypto from 'node:crypto';
import { request, expectOk, readBody, HttpError } from './http.js';

const MANAGEMENT_URL = 'https://api.supabase.com/v1';

export class SupabaseTarget {
  constructor({ url, projectRef, serviceRoleKey, accessToken }) {
    this.url = url;
    this.projectRef = projectRef;
    this.serviceRoleKey = serviceRoleKey;
    this.accessToken = accessToken;
  }

  get configured() {
    return Boolean(this.url && this.projectRef && this.serviceRoleKey && this.accessToken);
  }

  #serviceHeaders(extra = {}) {
    return {
      Authorization: `Bearer ${this.serviceRoleKey}`,
      apikey: this.serviceRoleKey,
      ...extra,
    };
  }

  // ---------------------------------------------------------------- Postgres

  /** Runs one SQL statement batch through the Management API. */
  async sql(query) {
    if (!this.accessToken) throw new HttpError(503, 'SUPABASE_ACCESS_TOKEN is not configured');
    const response = await request(
      `${MANAGEMENT_URL}/projects/${this.projectRef}/database/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
        timeoutMs: 120_000,
      },
    );
    return expectOk(response, 'Supabase DDL');
  }

  async publicTables() {
    const rows = await this.sql(
      "select table_name from information_schema.tables where table_schema = 'public'",
    );
    return Array.isArray(rows) ? rows.map((row) => row.table_name) : [];
  }

  // --------------------------------------------------------------- PostgREST

  async rest(path, { method = 'GET', body, prefer, headers = {} } = {}) {
    const response = await request(`${this.url}/rest/v1${path}`, {
      method,
      headers: this.#serviceHeaders({
        'Content-Type': 'application/json',
        ...(prefer ? { Prefer: prefer } : {}),
        ...headers,
      }),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return expectOk(response, `Supabase data ${method} ${path.split('?')[0]}`);
  }

  /** Row count for a table, or null when the table does not exist yet. */
  async countRows(table) {
    const response = await request(`${this.url}/rest/v1/${table}?select=id&limit=1`, {
      headers: this.#serviceHeaders({ Prefer: 'count=exact' }),
    });
    if (!response.ok) {
      const body = await readBody(response);
      const message = typeof body === 'string' ? body : JSON.stringify(body);
      if (response.status === 404 || /does not exist|schema cache/i.test(message || '')) {
        return { exists: false, count: 0 };
      }
      throw new HttpError(response.status, `Count failed for ${table}: ${message?.slice(0, 200)}`);
    }
    const range = response.headers.get('content-range') || '';
    const total = Number(range.split('/')[1]);
    return { exists: true, count: Number.isFinite(total) ? total : 0 };
  }

  async selectIds(table, { cap = 20_000 } = {}) {
    const response = await request(`${this.url}/rest/v1/${table}?select=id&limit=${cap}`, {
      headers: this.#serviceHeaders(),
    });
    if (!response.ok) return [];
    const rows = await readBody(response);
    return Array.isArray(rows) ? rows.map((row) => row.id) : [];
  }

  /**
   * Inserts a batch, never clobbering existing rows unless conflictMode is
   * `overwrite`. Returns the rows the target actually wrote.
   */
  async upsertRows(table, rows, conflictMode = 'skip') {
    const resolution =
      conflictMode === 'overwrite' ? 'resolution=merge-duplicates' : 'resolution=ignore-duplicates';
    return this.rest(`/${table}?on_conflict=id`, {
      method: 'POST',
      body: rows,
      prefer: `${resolution},return=representation`,
    });
  }

  // ----------------------------------------------------------------- Storage

  async listBuckets() {
    const response = await request(`${this.url}/storage/v1/bucket`, {
      headers: this.#serviceHeaders(),
    });
    const buckets = await expectOk(response, 'List storage buckets');
    return Array.isArray(buckets) ? buckets : [];
  }

  /** Creates the bucket when it is missing; keeps visibility in sync when it exists. */
  async ensureBucket(bucket) {
    const existing = (await this.listBuckets()).find((entry) => entry.id === bucket.id);
    if (existing) {
      if (Boolean(existing.public) !== bucket.public) {
        await expectOk(
          await request(`${this.url}/storage/v1/bucket/${bucket.id}`, {
            method: 'PUT',
            headers: this.#serviceHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ public: bucket.public }),
          }),
          `Update bucket ${bucket.id}`,
        );
      }
      return { created: false, id: bucket.id, public: bucket.public };
    }

    await expectOk(
      await request(`${this.url}/storage/v1/bucket`, {
        method: 'POST',
        headers: this.#serviceHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id: bucket.id, name: bucket.id, public: bucket.public }),
      }),
      `Create bucket ${bucket.id}`,
    );
    return { created: true, id: bucket.id, public: bucket.public };
  }

  async uploadObject(bucketId, objectPath, bytes, contentType) {
    const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/');
    await expectOk(
      await request(`${this.url}/storage/v1/object/${bucketId}/${encodedPath}`, {
        method: 'POST',
        headers: this.#serviceHeaders({
          'Content-Type': contentType || 'application/octet-stream',
          'x-upsert': 'true',
        }),
        body: bytes,
        timeoutMs: 120_000,
      }),
      `Upload ${bucketId}/${objectPath}`,
    );
    return this.publicUrl(bucketId, objectPath);
  }

  publicUrl(bucketId, objectPath) {
    const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/');
    return `${this.url}/storage/v1/object/public/${bucketId}/${encodedPath}`;
  }

  // -------------------------------------------------------------------- Auth

  async listAuthUsers() {
    const users = [];
    const perPage = 1000;
    for (let page = 1; page <= 50; page++) {
      const response = await request(
        `${this.url}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
        { headers: this.#serviceHeaders() },
      );
      const body = await expectOk(response, 'List auth users');
      const batch = Array.isArray(body?.users) ? body.users : [];
      users.push(...batch);
      if (batch.length < perPage) break;
    }
    return users;
  }

  /**
   * Creates a confirmed auth user. Base44 password hashes cannot be replayed
   * into Supabase, so the account is created without a usable password and the
   * user resets it — identity, email and role are preserved.
   */
  async createAuthUser({ email, fullName, role, base44Id, disabled }) {
    const body = {
      email,
      email_confirm: true,
      // Supabase rejects passwords over 72 characters.
      password: crypto.randomBytes(24).toString('base64url'),
      user_metadata: { full_name: fullName || null, role: role || 'user', base44_id: base44Id },
      app_metadata: { base44_id: base44Id, role: role || 'user' },
    };
    if (disabled) body.ban_duration = '876000h';

    const response = await request(`${this.url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: this.#serviceHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      // Not idempotent: a blind retry could create a second account.
      retries: 0,
    });
    return expectOk(response, 'Create auth user');
  }

  async deleteAuthUser(id) {
    await expectOk(
      await request(`${this.url}/auth/v1/admin/users/${id}`, {
        method: 'DELETE',
        headers: this.#serviceHeaders(),
      }),
      'Delete auth user',
    );
  }
}

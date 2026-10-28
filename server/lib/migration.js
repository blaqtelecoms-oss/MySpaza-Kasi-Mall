/**
 * Migration orchestrator.
 *
 * Phases: preflight (read-only inventory) -> schema -> users -> data -> media
 * -> reconcile. Every phase is idempotent, so a retry resumes from the first
 * phase that did not finish and never duplicates rows or objects.
 */

import { BUCKETS, bucketById, bucketForField, mediaFieldsFor } from './buckets.js';
import { normalizeRow, buildSchemaSql } from './schema.js';
import { isBase44MediaUrl } from './base44.js';
import { HttpError } from './http.js';

const APPLY_PHASES = ['preflight', 'schema', 'users', 'data', 'media', 'reconcile'];
const DRY_RUN_PHASES = ['preflight'];
const MAX_FAILURES = 100;

/** Which phase a recorded issue belongs to, so a retry can re-run just that work. */
const SCOPE_PHASE = { users: 'users', data: 'data', media: 'media', 'media-references': 'media' };

function chunks(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function sanitizeSegment(value, fallback = 'file') {
  const cleaned = String(value || '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return cleaned || fallback;
}

function fileNameFromUrl(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || 'file');
  } catch {
    return 'file';
  }
}

export class MigrationRunner {
  constructor({ config, store, source, target, schemas, log = () => {} }) {
    this.config = config;
    this.store = store;
    this.source = source;
    this.target = target;
    this.schemas = schemas;
    this.log = log;
    this.activeRunId = null;
  }

  // ------------------------------------------------------------------ public

  async start({ mode = 'apply', conflictMode = 'skip' }) {
    if (this.activeRunId) {
      throw new HttpError(409, 'A migration run is already in progress.');
    }
    if (mode === 'apply' && conflictMode !== 'skip' && conflictMode !== 'overwrite') {
      throw new HttpError(400, 'conflictMode must be "skip" or "overwrite".');
    }
    const run = this.store.create({
      mode,
      conflictMode,
      phases: mode === 'dry-run' ? DRY_RUN_PHASES : APPLY_PHASES,
    });
    // Fire and forget: the HTTP layer answers with the run id and the client polls.
    this.execute(run).catch((error) => this.log(`run ${run.id} crashed: ${error.message}`));
    return run;
  }

  /** Resumes a failed or interrupted run from its first unfinished phase. */
  async retry(id) {
    const run = this.store.get(id);
    if (!run) throw new HttpError(404, 'Run not found.');
    if (this.activeRunId) throw new HttpError(409, 'A migration run is already in progress.');
    if (run.mode !== 'apply') throw new HttpError(400, 'Dry runs cannot be retried; start a new dry run.');

    let startIndex = run.phases.findIndex((phase) => phase.status !== 'completed');
    let retriedScopes = null;

    if (startIndex === -1) {
      // Every phase finished: retry whatever recorded issues, and everything after it.
      const scopes = new Set(
        run.failures.map((failure) => SCOPE_PHASE[failure.scope]).filter(Boolean),
      );
      startIndex = Math.min(
        ...run.phases.map((phase, index) => (scopes.has(phase.name) ? index : Infinity)),
      );
      if (!scopes.size || !Number.isFinite(startIndex)) {
        throw new HttpError(400, 'This run finished without issues; there is nothing to retry.');
      }
      retriedScopes = scopes;
      run.failures = run.failures.filter(
        (failure) => !SCOPE_PHASE[failure.scope] || !scopes.has(SCOPE_PHASE[failure.scope]),
      );
    }

    // Re-run from the earliest unfinished (or problematic) phase to the end so
    // the report is rebuilt from fresh numbers. Every phase is idempotent.
    for (let index = startIndex; index < run.phases.length; index++) {
      const phase = run.phases[index];
      phase.status = 'pending';
      phase.error = null;
      phase.progress = null;
    }
    this.store.save(run);
    this.execute(run).catch((error) => this.log(`retry ${run.id} crashed: ${error.message}`));
    return run;
  }

  // ---------------------------------------------------------------- executor

  async execute(run) {
    this.activeRunId = run.id;
    run.status = 'running';
    run.startedAt = run.startedAt || new Date().toISOString();
    run.finishedAt = null;
    this.store.save(run);

    try {
      for (const phase of run.phases) {
        if (phase.status === 'completed') continue;
        phase.status = 'running';
        phase.startedAt = new Date().toISOString();
        phase.error = null;
        this.store.save(run);

        try {
          const summary = await this.runPhase(phase.name, run);
          phase.summary = summary;
          phase.status = 'completed';
        } catch (error) {
          phase.status = 'failed';
          phase.error = error.message;
          run.status = 'failed';
          run.error = `${phase.name}: ${error.message}`;
          phase.finishedAt = new Date().toISOString();
          this.store.save(run);
          return;
        }
        phase.finishedAt = new Date().toISOString();
        phase.progress = null;
        this.store.save(run);
      }

      run.status = run.failures.length ? 'completed_with_errors' : 'completed';
    } finally {
      run.finishedAt = new Date().toISOString();
      this.activeRunId = null;
      this.store.save(run);
    }
  }

  runPhase(name, run) {
    switch (name) {
      case 'preflight':
        return this.preflight(run);
      case 'schema':
        return this.migrateSchema(run);
      case 'users':
        return this.migrateUsers(run);
      case 'data':
        return this.migrateData(run);
      case 'media':
        return this.migrateMedia(run);
      case 'reconcile':
        return this.reconcile(run);
      default:
        throw new Error(`Unknown phase ${name}`);
    }
  }

  #progress(run, phase, patch) {
    const entry = run.phases.find((item) => item.name === phase);
    if (!entry) return;
    entry.progress = { ...(entry.progress || {}), ...patch, updatedAt: new Date().toISOString() };
    this.store.save(run);
  }

  #fail(run, failure) {
    if (run.failures.length >= MAX_FAILURES) return;
    run.failures.push({ at: new Date().toISOString(), ...failure });
  }

  // --------------------------------------------------------------- preflight

  async preflight(run) {
    const warnings = [];
    const tables = [];
    let mediaReferences = 0;

    for (const schema of this.schemas) {
      const records = await this.source.listAll(schema.name);
      const mediaFields = mediaFieldsFor(schema.name);
      const refs = countMediaReferences(records, schema, mediaFields);
      mediaReferences += refs.total;

      const target = await this.target.countRows(schema.table);
      const targetIds = target.exists ? await this.target.selectIds(schema.table) : [];
      const sourceIds = new Set(records.map((record) => String(record.id)));
      const existing = targetIds.filter((id) => sourceIds.has(id)).length;

      tables.push({
        entity: schema.name,
        table: schema.table,
        sourceRows: records.length,
        targetExists: target.exists,
        targetRows: target.count,
        overlappingRows: existing,
        mediaReferences: refs.total,
        mediaFields,
      });
    }

    const sourceUsers = await this.source.listUsers();
    const authUsers = await this.target.listAuthUsers().catch(() => []);
    let profiles = [];
    try {
      profiles = await this.target.rest('/profiles?select=id,base44_id,email');
    } catch {
      profiles = [];
    }

    const existingBuckets = await this.target.listBuckets();
    const buckets = BUCKETS.map((bucket) => {
      const found = existingBuckets.find((entry) => entry.id === bucket.id);
      return {
        id: bucket.id,
        label: bucket.label,
        description: bucket.description,
        public: bucket.public,
        entityFields: bucket.entityFields,
        exists: Boolean(found),
      };
    });

    const roles = sourceUsers.reduce((acc, user) => {
      const role = user.role || 'user';
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});

    if (sourceUsers.length) {
      warnings.push(
        `${sourceUsers.length} user account(s) will be recreated with their email, name and role. Base44 password hashes cannot be replayed into Supabase, so each user must set a new password.`,
      );
    }
    if (sourceUsers.some((user) => !user.email)) {
      warnings.push('Some source users have no email address and cannot be recreated.');
    }

    const withExistingRows = tables.filter((table) => table.overlappingRows > 0);
    if (withExistingRows.length) {
      warnings.push(
        `${withExistingRows.reduce((sum, table) => sum + table.overlappingRows, 0)} row(s) already exist in the target project across ${withExistingRows.length} table(s). Conflict mode "${run.conflictMode}" decides whether they are left untouched or overwritten.`,
      );
    }

    const inventory = {
      mode: run.mode,
      conflictMode: run.conflictMode,
      source: {
        appId: this.config.base44.appId,
        apiUrl: this.config.base44.sourceApiUrl,
        entities: this.schemas.length,
        records: tables.reduce((sum, table) => sum + table.sourceRows, 0),
        users: sourceUsers.length,
        userRoles: roles,
        mediaReferences,
      },
      target: {
        projectRef: this.target.projectRef,
        url: this.target.url,
        authUsers: authUsers.length,
        profiles: Array.isArray(profiles) ? profiles.length : 0,
        existingTables: tables.filter((table) => table.targetExists).length,
      },
      tables,
      buckets,
      warnings,
    };

    run.inventory = inventory;

    if (run.mode === 'dry-run') {
      run.report = {
        kind: 'dry-run',
        generatedAt: new Date().toISOString(),
        inventory,
        bucketPlan: buckets.map((bucket) => ({
          ...bucket,
          referencedMedia: tables
            .filter((table) => bucket.entityFields.some((entry) => entry.entity === table.entity))
            .reduce((sum, table) => sum + table.mediaReferences, 0),
        })),
      };
      this.store.save(run);
    }

    return {
      records: inventory.source.records,
      users: sourceUsers.length,
      mediaReferences,
      tables: tables.length,
      warnings: warnings.length,
    };
  }

  // ------------------------------------------------------------------ schema

  async migrateSchema(run) {
    const createdBuckets = [];
    for (const [index, bucket] of BUCKETS.entries()) {
      const result = await this.target.ensureBucket(bucket);
      createdBuckets.push(result);
      this.#progress(run, 'schema', { done: index + 1, total: BUCKETS.length + 1, unit: 'steps' });
    }

    await this.target.sql(buildSchemaSql(this.schemas, BUCKETS));
    this.#progress(run, 'schema', { done: BUCKETS.length + 1, total: BUCKETS.length + 1, unit: 'steps' });

    return {
      tables: this.schemas.map((schema) => schema.table),
      buckets: createdBuckets,
    };
  }

  // ------------------------------------------------------------------- users

  async migrateUsers(run) {
    const sourceUsers = await this.source.listUsers();
    const authUsers = await this.target.listAuthUsers();
    const byEmail = new Map(
      authUsers.filter((user) => user.email).map((user) => [user.email.toLowerCase(), user]),
    );

    let profiles = [];
    try {
      profiles = await this.target.rest('/profiles?select=id,base44_id,email');
    } catch {
      profiles = [];
    }
    const knownBase44Ids = new Set((profiles || []).map((row) => row.base44_id).filter(Boolean));

    const result = { source: sourceUsers.length, created: 0, skipped: 0, failed: 0, requiresPasswordReset: 0 };

    for (const [index, user] of sourceUsers.entries()) {
      const email = (user.email || '').toLowerCase();
      if (!email) {
        result.failed += 1;
        this.#fail(run, { scope: 'users', key: user.id, message: 'Source user has no email address' });
        continue;
      }
      if (knownBase44Ids.has(user.id)) {
        result.skipped += 1;
        this.#progress(run, 'users', { done: index + 1, total: sourceUsers.length, unit: 'users' });
        continue;
      }

      try {
        const existingAuth = byEmail.get(email);
        if (existingAuth) {
          // The auth user survived an earlier attempt but its profile did not:
          // repair it instead of skipping the account forever.
          await this.upsertProfile(user, existingAuth.id, email);
          result.skipped += 1;
        } else {
          const created = await this.target.createAuthUser({
            email,
            fullName: user.full_name,
            role: user.role,
            base44Id: user.id,
            disabled: Boolean(user.disabled),
          });
          await this.upsertProfile(user, created.id, email);
          result.created += 1;
          result.requiresPasswordReset += 1;
        }
      } catch (error) {
        result.failed += 1;
        this.#fail(run, { scope: 'users', key: email, message: error.message });
      }
      this.#progress(run, 'users', { done: index + 1, total: sourceUsers.length, unit: 'users' });
    }

    return result;
  }

  /** Mirrors a Base44 account into `public.profiles` (idempotent on base44_id). */
  async upsertProfile(user, authUserId, email) {
    await this.target.rest('/profiles?on_conflict=base44_id', {
      method: 'POST',
      body: [
        {
          id: authUserId,
          base44_id: user.id,
          email,
          full_name: user.full_name || null,
          role: user.role || 'user',
          is_verified: user.is_verified !== false,
          disabled: Boolean(user.disabled),
        },
      ],
      prefer: 'resolution=merge-duplicates,return=representation',
    });
  }

  // -------------------------------------------------------------------- data

  async migrateData(run) {
    const tables = [];
    run.report = { ...(run.report || {}), tables };

    for (const schema of this.schemas) {
      const records = await this.source.listAll(schema.name);
      const rows = [];
      for (const record of records) {
        const { row, problems } = normalizeRow(record, schema);
        rows.push(row);
        if (problems.length) {
          this.#fail(run, {
            scope: 'data',
            key: `${schema.table}/${row.id}`,
            message: `Fields defaulted to null: ${problems.join(', ')}`,
          });
        }
      }

      const tableResult = {
        entity: schema.name,
        table: schema.table,
        sourceRows: rows.length,
        written: 0,
        skipped: 0,
        failed: 0,
      };

      let processed = 0;
      for (const batch of chunks(rows, this.config.batchSize)) {
        try {
          const written = await this.target.upsertRows(schema.table, batch, run.conflictMode);
          const count = Array.isArray(written) ? written.length : 0;
          tableResult.written += count;
          tableResult.skipped += batch.length - count;
        } catch (batchError) {
          // Isolate the offending rows instead of losing the whole batch.
          for (const row of batch) {
            try {
              const written = await this.target.upsertRows(schema.table, [row], run.conflictMode);
              if (Array.isArray(written) && written.length) tableResult.written += 1;
              else tableResult.skipped += 1;
            } catch (rowError) {
              tableResult.failed += 1;
              this.#fail(run, {
                scope: 'data',
                key: `${schema.table}/${row.id}`,
                message: rowError.message,
              });
            }
          }
        }
        processed += batch.length;
        this.#progress(run, 'data', {
          done: processed,
          total: rows.length,
          unit: 'rows',
          table: schema.table,
        });
        this.store.save(run);
      }

      tables.push(tableResult);
    }

    return { tables: tables.length };
  }

  // ------------------------------------------------------------------- media

  async migrateMedia(run) {
    const assets = await this.discoverMedia();
    const bucketStats = new Map(
      BUCKETS.map((bucket) => [bucket.id, { id: bucket.id, public: bucket.public, uploaded: 0, skipped: 0, failed: 0, bytes: 0 }]),
    );

    const existing = new Set();
    try {
      const rows = await this.target.rest('/media_assets?select=bucket_id,object_path');
      for (const row of rows || []) existing.add(`${row.bucket_id}/${row.object_path}`);
    } catch {
      /* table is created by the schema phase; an empty read here means nothing migrated yet */
    }

    const patches = new Map();
    const queue = [...assets];
    let processed = 0;

    const processOne = async (asset) => {
      const bucket = bucketById(asset.bucketId);
      const objectPath = `${sanitizeSegment(asset.recordId)}/${sanitizeSegment(asset.column, 'media')}-${sanitizeSegment(fileNameFromUrl(asset.url))}`;
      const key = `${bucket.id}/${objectPath}`;
      const stats = bucketStats.get(bucket.id);

      try {
        let reference;
        if (existing.has(key)) {
          reference = bucket.public
            ? this.target.publicUrl(bucket.id, objectPath)
            : `${bucket.id}/${objectPath}`;
          stats.skipped += 1;
        } else {
          const media = await this.source.downloadMedia(asset.url);
          reference = await this.target.uploadObject(
            bucket.id,
            objectPath,
            media.bytes,
            media.contentType,
          );
          if (!bucket.public) reference = `${bucket.id}/${objectPath}`;

          await this.target.rest('/media_assets?on_conflict=bucket_id,object_path', {
            method: 'POST',
            body: [
              {
                bucket_id: bucket.id,
                object_path: objectPath,
                source_url: asset.url,
                entity: asset.entity,
                record_id: asset.recordId,
                field: asset.column,
                content_type: media.contentType,
                byte_size: media.bytes.length,
                reference,
              },
            ],
            prefer: 'resolution=merge-duplicates,return=representation',
          });
          existing.add(key);
          stats.uploaded += 1;
          stats.bytes += media.bytes.length;
        }

        if (asset.topLevel) {
          if (!patches.has(asset.table)) patches.set(asset.table, []);
          const rows = patches.get(asset.table);
          const existingPatch = rows.find((row) => row.id === asset.recordId);
          if (existingPatch) existingPatch[asset.column] = reference;
          else rows.push({ id: asset.recordId, [asset.column]: reference });
        }
      } catch (error) {
        stats.failed += 1;
        this.#fail(run, {
          scope: 'media',
          key: `${asset.entity}/${asset.recordId}/${asset.column}`,
          message: error.message,
        });
      } finally {
        processed += 1;
        this.#progress(run, 'media', { done: processed, total: assets.length, unit: 'assets' });
      }
    };

    const workers = Array.from(
      { length: Math.max(1, Math.min(this.config.mediaConcurrency, queue.length || 1)) },
      async () => {
        while (queue.length) {
          const asset = queue.shift();
          await processOne(asset);
        }
      },
    );
    await Promise.all(workers);

    // Point the migrated rows at their new storage location.
    let referencesUpdated = 0;
    for (const [table, rows] of patches.entries()) {
      for (const batch of chunks(rows, this.config.batchSize)) {
        try {
          const written = await this.target.upsertRows(table, batch, 'overwrite');
          referencesUpdated += Array.isArray(written) ? written.length : 0;
        } catch (error) {
          this.#fail(run, {
            scope: 'media-references',
            key: table,
            message: error.message,
          });
        }
      }
    }

    const buckets = [...bucketStats.values()];
    const summary = {
      discovered: assets.length,
      uploaded: buckets.reduce((sum, bucket) => sum + bucket.uploaded, 0),
      skipped: buckets.reduce((sum, bucket) => sum + bucket.skipped, 0),
      failed: buckets.reduce((sum, bucket) => sum + bucket.failed, 0),
      bytes: buckets.reduce((sum, bucket) => sum + bucket.bytes, 0),
      referencesUpdated,
      buckets,
    };

    run.report = { ...(run.report || {}), media: summary };
    this.store.save(run);
    return summary;
  }

  /** Finds every Base44 media reference in the source, split by bucket. */
  async discoverMedia() {
    const assets = [];
    for (const schema of this.schemas) {
      const records = await this.source.listAll(schema.name);
      for (const record of records) {
        for (const field of schema.fields) {
          const value = record[field.name];
          if (!isBase44MediaUrl(value)) continue;
          assets.push({
            entity: schema.name,
            table: schema.table,
            recordId: String(record.id),
            column: field.name,
            url: value,
            bucketId: bucketForField(schema.name, field.name),
            topLevel: true,
          });
        }
        for (const field of schema.fields) {
          const value = record[field.name];
          if (!value || typeof value !== 'object') continue;
          for (const url of nestedMediaUrls(value)) {
            assets.push({
              entity: schema.name,
              table: schema.table,
              recordId: String(record.id),
              column: `${field.name}.nested`,
              url,
              bucketId: bucketForField(schema.name, field.name),
              topLevel: false,
            });
          }
        }
      }
    }
    return assets;
  }

  // --------------------------------------------------------------- reconcile

  async reconcile(run) {
    const tables = [];
    for (const schema of this.schemas) {
      const records = await this.source.listAll(schema.name);
      const sourceIds = records.map((record) => String(record.id));
      const target = await this.target.countRows(schema.table);
      const targetIds = new Set(await this.target.selectIds(schema.table));
      const missing = sourceIds.filter((id) => !targetIds.has(id));
      tables.push({
        entity: schema.name,
        table: schema.table,
        sourceRows: sourceIds.length,
        targetRows: target.count,
        missingCount: missing.length,
        missingSample: missing.slice(0, 10),
      });
    }

    const sourceUsers = await this.source.listUsers();
    let profileCount = 0;
    try {
      const profiles = await this.target.rest('/profiles?select=id');
      profileCount = Array.isArray(profiles) ? profiles.length : 0;
    } catch {
      profileCount = 0;
    }

    const media = run.report?.media || null;
    const dataTables = run.report?.tables || [];
    const tablesWithGaps = tables.filter((table) => table.missingCount > 0);

    run.report = {
      kind: 'apply',
      generatedAt: new Date().toISOString(),
      mode: run.mode,
      conflictMode: run.conflictMode,
      inventory: run.inventory,
      tables: dataTables,
      users: run.phases.find((phase) => phase.name === 'users')?.summary || null,
      media,
      schema: run.phases.find((phase) => phase.name === 'schema')?.summary || null,
      reconciliation: {
        tables,
        tablesWithGaps: tablesWithGaps.length,
        mediaFailures: media ? media.failed : 0,
        users: {
          source: sourceUsers.length,
          migrated: profileCount,
          gaps: Math.max(0, sourceUsers.length - profileCount),
        },
        clean: tablesWithGaps.length === 0 && !run.failures.length,
      },
      warnings: run.inventory?.warnings || [],
      failures: run.failures.slice(0, MAX_FAILURES),
    };
    this.store.save(run);

    return {
      tablesClean: tables.length - tablesWithGaps.length,
      tablesWithGaps: tablesWithGaps.length,
      usersMigrated: profileCount,
    };
  }
}

function countMediaReferences(records, schema, mediaFields) {
  let topLevel = 0;
  let nested = 0;
  for (const record of records) {
    for (const field of mediaFields) {
      if (isBase44MediaUrl(record[field])) topLevel += 1;
    }
    for (const field of schema.fields) {
      const value = record[field.name];
      if (value && typeof value === 'object') nested += nestedMediaUrls(value).length;
    }
  }
  return { total: topLevel + nested, topLevel, nested };
}

function nestedMediaUrls(value) {
  const found = [];
  const walk = (node) => {
    if (!node) return;
    if (typeof node === 'string') {
      if (isBase44MediaUrl(node)) found.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node === 'object') {
      for (const item of Object.values(node)) walk(item);
    }
  };
  walk(value);
  return found;
}

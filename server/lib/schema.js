/**
 * Translates the Base44 entity definitions into an idempotent Postgres schema
 * and normalises source records into row objects the target accepts.
 */

const SYSTEM_COLUMNS = [
  { name: 'created_date', type: 'timestamptz' },
  { name: 'updated_date', type: 'timestamptz' },
  { name: 'created_by_id', type: 'text' },
  { name: 'is_sample', type: 'boolean' },
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}/;

export function columnType(field) {
  switch (field.type) {
    case 'number':
      return 'double precision';
    case 'boolean':
      return 'boolean';
    case 'array':
    case 'object':
      return 'jsonb';
    case 'string':
      if (field.format === 'date') return 'date';
      if (field.format === 'date-time') return 'timestamptz';
      return 'text';
    default:
      return 'text';
  }
}

function isEmpty(value) {
  return value === null || value === undefined || value === '';
}

/**
 * Coerces one source record into a row for `public.<table>`.
 * Values that cannot be represented are dropped to null and reported, so a
 * single bad field never fails a whole record.
 */
export function normalizeRow(record, schema) {
  const row = { id: String(record.id) };
  const problems = [];

  for (const field of schema.fields) {
    const type = columnType(field);
    const value = record[field.name];

    if (isEmpty(value)) {
      row[field.name] = null;
      continue;
    }

    if (type === 'double precision') {
      const num = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(num)) row[field.name] = num;
      else {
        row[field.name] = null;
        problems.push(`${field.name}: not a number`);
      }
      continue;
    }

    if (type === 'boolean') {
      if (typeof value === 'boolean') row[field.name] = value;
      else if (value === 'true' || value === 1) row[field.name] = true;
      else if (value === 'false' || value === 0) row[field.name] = false;
      else {
        row[field.name] = null;
        problems.push(`${field.name}: not a boolean`);
      }
      continue;
    }

    if (type === 'date') {
      if (typeof value === 'string' && DATE_PATTERN.test(value)) row[field.name] = value.slice(0, 10);
      else {
        row[field.name] = null;
        problems.push(`${field.name}: not a date`);
      }
      continue;
    }

    if (type === 'timestamptz') {
      if (typeof value === 'string' && DATE_PATTERN.test(value)) row[field.name] = value;
      else {
        row[field.name] = null;
        problems.push(`${field.name}: not a timestamp`);
      }
      continue;
    }

    if (type === 'jsonb') {
      row[field.name] = typeof value === 'string' ? safeJson(value) : value;
      continue;
    }

    row[field.name] = typeof value === 'string' ? value : String(value);
  }

  for (const column of SYSTEM_COLUMNS) {
    const value = record[column.name];
    if (isEmpty(value)) {
      row[column.name] = null;
    } else if (column.type === 'boolean') {
      row[column.name] = typeof value === 'boolean' ? value : value === 'true';
    } else if (column.type === 'timestamptz') {
      row[column.name] = TYPE_SAFE_TIMESTAMP(value) ? value : null;
    } else {
      row[column.name] = String(value);
    }
  }

  return { row, problems };
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function TYPE_SAFE_TIMESTAMP(value) {
  return typeof value === 'string' && DATE_PATTERN.test(value);
}

function quoteIdent(name) {
  return `"${name.replace(/"/g, '""')}"`;
}

function tableDdl(schema) {
  const columns = [
    '  id text primary key',
    ...schema.fields.map((field) => `  ${quoteIdent(field.name)} ${columnType(field)}`),
    ...SYSTEM_COLUMNS.map((column) => `  ${quoteIdent(column.name)} ${column.type}`),
  ];
  return `create table if not exists public.${schema.table} (\n${columns.join(',\n')}\n);`;
}

function tableUpgradeDdl(schema) {
  return [
    ...schema.fields.map(
      (field) =>
        `alter table public.${schema.table} add column if not exists ${quoteIdent(field.name)} ${columnType(field)};`,
    ),
    ...SYSTEM_COLUMNS.map(
      (column) =>
        `alter table public.${schema.table} add column if not exists ${quoteIdent(column.name)} ${column.type};`,
    ),
  ];
}

function tablePolicyDdl(schema) {
  const policy = `${schema.table}_authenticated_all`;
  return [
    `alter table public.${schema.table} enable row level security;`,
    `drop policy if exists ${policy} on public.${schema.table};`,
    `create policy ${policy} on public.${schema.table} for all to authenticated using (true) with check (true);`,
    `grant select, insert, update, delete on public.${schema.table} to authenticated;`,
    `create index if not exists ${schema.table}_created_date_idx on public.${schema.table} (created_date desc);`,
  ];
}

function storagePolicyDdl(bucket) {
  const policyPrefix = `bucket_${bucket.id.replace(/[^a-z0-9]+/g, '_')}`;
  const statements = [];
  if (bucket.public) {
    statements.push(
      `drop policy if exists ${policyPrefix}_read on storage.objects;`,
      `create policy ${policyPrefix}_read on storage.objects for select to anon, authenticated using (bucket_id = '${bucket.id}');`,
    );
  } else {
    statements.push(
      `drop policy if exists ${policyPrefix}_read on storage.objects;`,
      `create policy ${policyPrefix}_read on storage.objects for select to authenticated using (bucket_id = '${bucket.id}');`,
      `drop policy if exists ${policyPrefix}_write on storage.objects;`,
      `create policy ${policyPrefix}_write on storage.objects for insert to authenticated with check (bucket_id = '${bucket.id}');`,
    );
  }
  return statements;
}

/** Supporting tables that are not derived from a Base44 entity. */
const SUPPORT_DDL = `
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  base44_id text unique,
  email text not null,
  full_name text,
  role text not null default 'user',
  is_verified boolean default true,
  disabled boolean default false,
  migrated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists profiles_authenticated_all on public.profiles;
create policy profiles_authenticated_all on public.profiles for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.profiles to authenticated;

create table if not exists public.media_assets (
  bucket_id text not null,
  object_path text not null,
  source_url text,
  entity text,
  record_id text,
  field text,
  content_type text,
  byte_size bigint,
  reference text,
  migrated_at timestamptz not null default now(),
  primary key (bucket_id, object_path)
);
alter table public.media_assets enable row level security;
drop policy if exists media_assets_authenticated_read on public.media_assets;
create policy media_assets_authenticated_read on public.media_assets for select to authenticated using (true);
grant select on public.media_assets to authenticated;
`;

/** Full, idempotent schema for one migration attempt. */
export function buildSchemaSql(schemas, buckets) {
  const statements = ['create extension if not exists pgcrypto;'];

  for (const schema of schemas) {
    statements.push(tableDdl(schema), ...tableUpgradeDdl(schema), ...tablePolicyDdl(schema));
  }
  statements.push(SUPPORT_DDL.trim());
  for (const bucket of buckets) statements.push(...storagePolicyDdl(bucket));

  return statements.join('\n\n');
}

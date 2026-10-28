/**
 * Reads the Base44 entity definitions that ship with the repository so the
 * migration knows the real schema of the source app instead of guessing.
 */

import fs from 'node:fs';
import path from 'node:path';

/** System columns Base44 adds to every record. */
export const SYSTEM_FIELDS = [
  { name: 'created_date', type: 'string', format: 'date-time' },
  { name: 'updated_date', type: 'string', format: 'date-time' },
  { name: 'created_by_id', type: 'string' },
  { name: 'is_sample', type: 'boolean' },
];

/** Tolerant JSONC reader (comments + trailing commas) without dependencies. */
export function parseJsonc(text) {
  let out = '';
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (lineComment) {
      if (char === '\n') {
        lineComment = false;
        out += char;
      }
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      out += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      out += char;
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      i++;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      i++;
      continue;
    }
    out += char;
  }

  return out.replace(/,(\s*[}\]])/g, '$1');
}

export function toSnakeCase(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * @returns {{name: string, table: string, fields: {name: string, type: string, format?: string}[], relations: string[]}[]}
 */
export function loadEntitySchemas(dir) {
  if (!fs.existsSync(dir)) return [];
  const schemas = [];

  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.jsonc'))) {
    let parsed;
    try {
      parsed = JSON.parse(parseJsonc(fs.readFileSync(path.join(dir, file), 'utf8')));
    } catch {
      continue;
    }
    const name = parsed.name || path.basename(file, '.jsonc');
    // User is auth-backed: the users phase migrates it into auth.users + profiles.
    if (name === 'User') continue;

    const fields = Object.entries(parsed.properties || {})
      .filter(([field]) => field !== 'id' && !SYSTEM_FIELDS.some((sys) => sys.name === field))
      .map(([field, definition]) => ({
        name: field,
        type: definition.type || 'string',
        format: definition.format,
      }));

    const relations = fields
      .filter((field) => field.name.endsWith('_id') && field.type === 'string')
      .map((field) => field.name);

    schemas.push({ name, table: toSnakeCase(name), fields, relations });
  }

  return schemas.sort((a, b) => a.name.localeCompare(b.name));
}

export function allColumns(schema) {
  return [{ name: 'id', type: 'string' }, ...schema.fields, ...SYSTEM_FIELDS];
}

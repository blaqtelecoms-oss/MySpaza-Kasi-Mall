// Hybrid offline storage layer.
// IndexedDB holds large datasets (per-filter read caches, pending queue, conflicts, temp-id map).
// localStorage holds small metadata (per-entity read-cache index).

const DB_NAME = "myspaza_offline";
const DB_VERSION = 2;
const STORES = ["collections", "queue", "tempIds", "conflicts"];

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of STORES) {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function store(name, mode) {
  const db = await openDB();
  if (!db) return null;
  try {
    return db.transaction(name, mode).objectStore(name);
  } catch {
    return null;
  }
}

export async function idbGet(name, key) {
  const os = await store(name, "readonly");
  if (!os) return undefined;
  return new Promise((resolve) => {
    const r = os.get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => resolve(undefined);
  });
}

export async function idbSet(name, key, val) {
  const os = await store(name, "readwrite");
  if (!os) return;
  return new Promise((resolve) => {
    const r = os.put(val, key);
    r.onsuccess = () => resolve();
    r.onerror = () => resolve();
  });
}

export async function idbDel(name, key) {
  const os = await store(name, "readwrite");
  if (!os) return;
  return new Promise((resolve) => {
    const r = os.delete(key);
    r.onsuccess = () => resolve();
    r.onerror = () => resolve();
  });
}

export async function idbGetAll(name) {
  const os = await store(name, "readonly");
  if (!os) return [];
  return new Promise((resolve) => {
    const r = os.getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => resolve([]);
  });
}

export async function idbClear(name) {
  const os = await store(name, "readwrite");
  if (!os) return;
  return new Promise((resolve) => {
    const r = os.clear();
    r.onsuccess = () => resolve();
    r.onerror = () => resolve();
  });
}

// localStorage helpers (small metadata only)
export function lsGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

export function lsSet(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

export function lsDel(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

// ---------------------------------------------------------------------------
// Per-filter read cache: each list()/filter() result is stored under a key
// `${entity}::${readHash}` so pages that filter the same entity differently
// each keep their own cached set. A per-entity index in localStorage tracks
// which keys exist so optimistic writes can update every cached set.
// ---------------------------------------------------------------------------

const READ_INDEX_KEY = "myspaza_read_index";

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export function readCacheKey(entity, method, args) {
  return `${entity}::${method}::${simpleHash(JSON.stringify(args || []))}`;
}

function getReadIndex() {
  return lsGet(READ_INDEX_KEY, {}) || {};
}

function saveReadIndex(idx) {
  lsSet(READ_INDEX_KEY, idx);
}

function registerKey(entity, key) {
  const idx = getReadIndex();
  const set = new Set(idx[entity] || []);
  set.add(key);
  idx[entity] = Array.from(set);
  saveReadIndex(idx);
}

function unregisterKey(entity, key) {
  const idx = getReadIndex();
  const set = new Set(idx[entity] || []);
  set.delete(key);
  idx[entity] = Array.from(set);
  saveReadIndex(idx);
}

export function getKeysForEntity(entity) {
  const idx = getReadIndex();
  return idx[entity] || [];
}

// Store a read result (array for list/filter, object for get).
export async function setCachedRead(entity, method, args, result) {
  if (method === "get" && result && result.id) {
    // upsert the single record into every cached set for the entity
    await upsertRecordInSets(entity, result);
    return;
  }
  if ((method === "list" || method === "filter") && Array.isArray(result)) {
    const key = readCacheKey(entity, method, args);
    await idbSet("collections", key, result);
    registerKey(entity, key);
  }
}

// Resolve a read from cache. Falls back to applying the filter client-side
// against any cached set for the entity when no exact keyed match exists.
export async function getCachedRead(entity, method, args) {
  if (method === "get") {
    const id = args[0];
    const sets = await getAllCachedSets(entity);
    for (const set of sets) {
      const found = set.find((r) => r && r.id === id);
      if (found) return found;
    }
    return undefined;
  }
  const key = readCacheKey(entity, method, args);
  const exact = await idbGet("collections", key);
  if (Array.isArray(exact)) return exact;

  // Fallback: reuse any cached set for the entity and (for filter) re-apply args.
  const sets = await getAllCachedSets(entity);
  if (sets.length === 0) return [];
  const base = sets[0]; // most recently registered first via getKeysForEntity order
  if (method === "list") return applySortLimit(base, args[0], args[1]);
  if (method === "filter") return applyFilter(base, args[0], args[1], args[2]);
  return base;
}

// Load every cached array set for an entity (list + filter results).
export async function getAllCachedSets(entity) {
  const keys = getKeysForEntity(entity);
  const sets = [];
  for (const k of keys) {
    const v = await idbGet("collections", k);
    if (Array.isArray(v)) sets.push(v);
  }
  return sets;
}

// Upsert a record into every cached set for the entity (used by get/create/update).
export async function upsertRecordInSets(entity, record) {
  if (!record || !record.id) return;
  const keys = getKeysForEntity(entity);
  for (const k of keys) {
    const col = await idbGet("collections", k);
    if (!Array.isArray(col)) continue;
    const idx = col.findIndex((r) => r && r.id === record.id);
    const next = idx >= 0 ? [...col] : [...col, record];
    if (idx >= 0) next[idx] = { ...next[idx], ...record };
    await idbSet("collections", k, next);
  }
}

// Remove a record from every cached set for the entity (used by delete).
export async function removeRecordFromSets(entity, id) {
  const keys = getKeysForEntity(entity);
  for (const k of keys) {
    const col = await idbGet("collections", k);
    if (!Array.isArray(col)) continue;
    const next = col.filter((r) => r && r.id !== id);
    if (next.length !== col.length) await idbSet("collections", k, next);
  }
}

function recordMatchesFilter(record, filter) {
  if (!filter || typeof filter !== "object") return true;
  for (const [field, cond] of Object.entries(filter)) {
    if (cond && typeof cond === "object") {
      // operators like $gte, $lte, $in, etc. — best-effort equality range
      const val = record[field];
      if (cond.$ne !== undefined && val === cond.$ne) return false;
      if (cond.$gt !== undefined && !(val > cond.$gt)) return false;
      if (cond.$gte !== undefined && !(val >= cond.$gte)) return false;
      if (cond.$lt !== undefined && !(val < cond.$lt)) return false;
      if (cond.$lte !== undefined && !(val <= cond.$lte)) return false;
      if (Array.isArray(cond.$in) && !cond.$in.includes(val)) return false;
    } else if (record[field] !== cond) {
      return false;
    }
  }
  return true;
}

function applyFilter(arr, filterObj, sort, limit) {
  let out = (arr || []).filter((r) => recordMatchesFilter(r, filterObj));
  out = applySortLimit(out, sort, limit);
  return out;
}

function applySortLimit(arr, sort, limit) {
  let out = arr ? [...arr] : [];
  if (typeof sort === "string" && sort.length > 0) {
    const desc = sort.startsWith("-");
    const field = desc ? sort.slice(1) : sort;
    out.sort((a, b) => {
      const av = a ? a[field] : undefined;
      const bv = b ? b[field] : undefined;
      if (av === bv) return 0;
      return (av > bv ? 1 : -1) * (desc ? -1 : 1);
    });
  }
  if (typeof limit === "number" && limit > 0) out = out.slice(0, limit);
  return out;
}

// ---------------------------------------------------------------------------
// Conflicts store: parked queued items that conflicted with server state or
// exhausted retries. Mirrors the queue helpers.
// ---------------------------------------------------------------------------

export async function addConflict(conflict) {
  const id = conflict.id || "c_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  const full = { id, createdAt: Date.now(), ...conflict };
  await idbSet("conflicts", id, full);
  return full;
}

export async function getConflict(id) {
  return await idbGet("conflicts", id);
}

export async function getAllConflicts() {
  const all = await idbGetAll("conflicts");
  return all.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

export async function removeConflict(id) {
  await idbDel("conflicts", id);
}

export async function clearConflicts() {
  await idbClear("conflicts");
}
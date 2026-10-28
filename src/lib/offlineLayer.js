// Transparent offline layer: wraps base44.entities so every screen automatically
// caches reads (per filter), falls back to cache when offline, and queues writes
// to sync later — with conflict parking and reconnection auto-flush.
// Installed once in src/api/base44Client.js — no per-screen changes required.
import {
  setCachedRead,
  getCachedRead,
  getAllCachedSets,
  upsertRecordInSets,
  removeRecordFromSets,
  getKeysForEntity,
  idbSet,
  getAllConflicts,
} from "./offlineStorage";
import { enqueue, tempId, refreshPending } from "./offlineQueue";
import { setStatus, getStatus } from "./offlineStatus";
import { setOriginalsAccessor, initSyncEngine, flush } from "./syncEngine";
import { toast } from "@/components/ui/use-toast";

const READS = new Set(["list", "filter", "get"]);
const WRITES = new Set([
  "create", "update", "delete", "bulkCreate", "bulkUpdate", "updateMany", "deleteMany",
]);

const originals = new Map();
let installed = false;

function now() {
  return new Date().toISOString();
}

// Only genuine network-layer failures count as "offline" — i.e. there is no
// path to the server. A slow response (timeout) or a server error (5xx) means
// the internet is fine, so those never flip offline status.
function isNetworkError(err) {
  if (!err) return false;
  if (err instanceof TypeError) return true; // fetch() throws TypeError when the network is unreachable
  const m = (err.message || String(err)).toLowerCase();
  if (
    m.includes("failed to fetch") ||
    m.includes("network request failed") ||
    m.includes("networkerror") ||
    m.includes("err_internet_disconnected") ||
    m.includes("net::err") ||
    m.includes("name resolution") ||
    m.includes("dns ")
  )
    return true;
  // status 0 = request never reached a server (CORS/aborted/unreachable);
  // 5xx means the server answered, so we stay online and let it propagate.
  const status = err.status || err.statusCode;
  if (status === 0) return true;
  return false;
}

// A read that simply took longer than the cache fallback window. The network
// may still be working (just slow), so this must NOT engage offline mode.
function isTimeoutError(err) {
  if (!err) return false;
  const m = (err.message || String(err)).toLowerCase();
  return m.includes("timed out");
}

// Race a network read against a hard timeout so a stalled connection falls back
// to cache within seconds instead of pending for the browser's TCP timeout.
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Request timed out")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Hysteresis: a single flaky request must not flip the whole app offline.
// Only engage offline mode after several consecutive genuine network failures;
// one successful read resets the counter.
let consecutiveNetFailures = 0;
const OFFLINE_FAILURE_THRESHOLD = 3;

// Drive offline status from actual request results, not the browser signal.
// Toast only on a real transition to avoid spamming on every failed call.
function markOffline() {
  if (getStatus().online) {
    setStatus({ online: false });
    toast({
      title: "You're offline",
      description: "Showing cached data. New changes will sync when you reconnect.",
    });
  }
}

function markOnline() {
  consecutiveNetFailures = 0;
  if (!getStatus().online) {
    setStatus({ online: true });
    toast({ title: "Back online", description: "Syncing your changes…" });
    // A successful request that restored connectivity should drain the queue
    // even when no browser `online` event fires.
    setTimeout(flush, 0);
  }
}

// Called on a genuine network-layer failure; only trips offline after the
// threshold of consecutive failures is reached.
function recordNetFailure() {
  consecutiveNetFailures += 1;
  if (consecutiveNetFailures >= OFFLINE_FAILURE_THRESHOLD) markOffline();
}

// Wrap a single entity API object so its read/write methods are offline-aware.
function wrapEntity(original, name) {
  return new Proxy(original, {
    get(target, prop) {
      const value = target[prop];
      if (typeof value !== "function") return value;
      if (READS.has(prop)) return makeRead(name, prop, value, target);
      if (WRITES.has(prop)) return makeWrite(name, prop, value, target);
      return typeof value === "function" ? value.bind(target) : value; // subscribe, schema, etc.
    },
  });
}

const READ_TIMEOUT_MS = 4000;

function makeRead(entity, method, orig, target) {
  return async function (...args) {
    try {
      const result = await withTimeout(orig.apply(target, args), READ_TIMEOUT_MS);
      markOnline();
      setCachedRead(entity, method, args, result);
      return result;
    } catch (err) {
      // Slow-but-connected: serve cache silently and stay online (no banner).
      if (isTimeoutError(err)) {
        return getCachedRead(entity, method, args);
      }
      if (isNetworkError(err)) {
        recordNetFailure();
        return getCachedRead(entity, method, args);
      }
      throw err; // 5xx / business error — the server answered, stay online
    }
  };
}

function makeWrite(entity, method, orig, target) {
  return async function (...args) {
    try {
      const result = await orig.apply(target, args);
      markOnline();
      return result;
    } catch (err) {
      if (isNetworkError(err)) {
        recordNetFailure();
        return queueWrite(entity, method, args);
      }
      throw err; // real validation/business error — let the screen handle it
    }
  };
}

async function recordUpdatedDate(entity, id) {
  // Capture the current updated_date from any cached set so conflict detection
  // can compare it against the server's version on sync.
  const sets = await getAllCachedSets(entity);
  for (const set of sets) {
    const r = set.find((x) => x && x.id === id);
    if (r && r.updated_date) return r.updated_date;
  }
  return undefined;
}

async function queueWrite(entity, method, args) {
  switch (method) {
    case "create": {
      const payload = args[0] || {};
      const tid = tempId();
      const synth = { ...payload, id: tid, created_date: now(), updated_date: now() };
      await enqueue({ operation: "create", entity, payload, tempId: tid });
      await upsertRecordInSets(entity, synth);
      return synth;
    }
    case "update": {
      const [targetId, payload] = args;
      const baseUpdatedDate = await recordUpdatedDate(entity, targetId);
      const sets = await getAllCachedSets(entity);
      let current = { id: targetId };
      for (const set of sets) {
        const found = set.find((r) => r && r.id === targetId);
        if (found) { current = found; break; }
      }
      const synth = { ...current, ...payload, id: targetId, updated_date: now() };
      await enqueue({ operation: "update", entity, targetId, payload, baseUpdatedDate });
      await upsertRecordInSets(entity, synth);
      return synth;
    }
    case "delete": {
      const [targetId] = args;
      const baseUpdatedDate = await recordUpdatedDate(entity, targetId);
      await enqueue({ operation: "delete", entity, targetId, baseUpdatedDate });
      await removeRecordFromSets(entity, targetId);
      return { id: targetId };
    }
    case "bulkCreate": {
      const payloads = args[0] || [];
      const tids = payloads.map(() => tempId());
      const synths = payloads.map((p, i) => ({
        ...p, id: tids[i], created_date: now(), updated_date: now(),
      }));
      await enqueue({ operation: "bulkCreate", entity, payloads, tempIds: tids });
      for (const s of synths) await upsertRecordInSets(entity, s);
      return synths;
    }
    case "bulkUpdate": {
      const entries = args[0] || [];
      await enqueue({ operation: "bulkUpdate", entity, entries });
      for (const e of entries) await upsertRecordInSets(entity, { ...e, id: e.id });
      return entries;
    }
    case "updateMany": {
      const [filter, update] = args;
      await enqueue({ operation: "updateMany", entity, filter, update });
      await applyUpdateManyLocal(entity, filter, update);
      return { ok: true };
    }
    case "deleteMany": {
      const [filter] = args;
      await enqueue({ operation: "deleteMany", entity, filter });
      await applyDeleteManyLocal(entity, filter);
      return { ok: true };
    }
  }
}

// Best-effort local application of updateMany across all cached sets.
async function applyUpdateManyLocal(entity, filter, update) {
  const sets = await getAllCachedSets(entity);
  const $set = (update && update.$set) || {};
  for (let i = 0; i < sets.length; i++) {
    const col = sets[i];
    let changed = false;
    const next = col.map((r) => {
      if (matchesLocal(r, filter)) {
        changed = true;
        return { ...r, ...$set, updated_date: now() };
      }
      return r;
    });
    if (changed) {
      const key = (await getKeysForEntity(entity))[i];
      if (key) await setCollectionRaw(key, next);
    }
  }
}

async function applyDeleteManyLocal(entity, filter) {
  const sets = await getAllCachedSets(entity);
  const keys = await getKeysForEntity(entity);
  for (let i = 0; i < sets.length; i++) {
    const col = sets[i];
    const next = col.filter((r) => !matchesLocal(r, filter));
    if (next.length !== col.length) {
      const key = keys[i];
      if (key) await setCollectionRaw(key, next);
    }
  }
}

function matchesLocal(record, filter) {
  if (!filter || typeof filter !== "object") return true;
  for (const [field, cond] of Object.entries(filter)) {
    if (cond && typeof cond === "object") {
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

export function installOfflineLayer(base44) {
  if (installed || !base44 || !base44.entities) return;
  const target = base44.entities;

  try {
    base44.entities = new Proxy(target, {
      get(t, prop) {
        const entity = t[prop];
        if (entity && typeof entity === "object") {
          if (!originals.has(prop)) originals.set(prop, entity);
          return wrapEntity(entity, prop);
        }
        return entity;
      },
    });
  } catch {
    // Client object is non-writable (e.g. frozen) — bail out, app stays online-only.
    console.warn("[offline] Could not install entity proxy — app will run online-only.");
    return;
  }

  // Verify the assignment actually took effect (silent no-op if the property
  // was non-writable in a non-strict context).
  if (base44.entities === target) {
    console.warn("[offline] Entity proxy did not apply — base44.entities is unchanged. App will run online-only.");
    return;
  }

  setOriginalsAccessor((name) => originals.get(name));

  setStatus({ online: typeof navigator === "undefined" ? true : navigator.onLine });
  refreshPending();
  refreshConflicts();
  initSyncEngine();

  if (typeof window !== "undefined") {
    // The browser's connectivity signal is authoritative for genuine loss of
    // internet (airplane mode, data off, no route) — engage offline instantly.
    window.addEventListener("offline", () => {
      consecutiveNetFailures = OFFLINE_FAILURE_THRESHOLD;
      markOffline();
    });
    window.addEventListener("online", () => {
      markOnline();
      setTimeout(flush, 600);
    });
  }

  installed = true;
}

async function setCollectionRaw(key, arr) {
  await idbSet("collections", key, arr);
}

async function refreshConflicts() {
  try {
    const list = await getAllConflicts();
    setStatus({ conflicts: list.length });
  } catch {
    /* ignore */
  }
}
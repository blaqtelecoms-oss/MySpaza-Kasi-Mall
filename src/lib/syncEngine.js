// Sync engine: replays queued writes against the backend when online, with
// retry/backoff, conflict detection (park for review), and max-retry parking.
import { getQueue, removeQueue, updateEntry, setTempMap } from "./offlineQueue";
import { addConflict, getAllConflicts } from "./offlineStorage";
import { setStatus } from "./offlineStatus";

const MAX_ATTEMPTS = 5;
// Increasing delays between retries; capped so a stuck item never floods the server.
const BACKOFF = [0, 2000, 5000, 15000, 30000, 60000];

let flushing = false;
let accessor = null; // (entityName) => original (unwrapped) entity API object

export function setOriginalsAccessor(fn) {
  accessor = fn;
}

export async function flush() {
  if (flushing) return;
  const queue = await getQueue();
  if (queue.length === 0) {
    setStatus({ syncing: false });
    return;
  }

  flushing = true;
  setStatus({ syncing: true });

  const tempMap = {};
  let succeeded = 0;
  let failed = false;
  const now = Date.now();

  for (const entry of queue) {
    // Honor backoff: skip items not yet due for another attempt.
    if (entry.nextAttemptAt && entry.nextAttemptAt > now) continue;

    try {
      await runOne(entry, tempMap);
      await removeQueue(entry.id);
      succeeded++;
    } catch (err) {
      // Conflict (detected inside runOne) is parked there, not thrown.
      if (err && err.__conflict) continue;

      failed = true;
      const retry = (entry.retryCount || 0) + 1;
      if (retry >= MAX_ATTEMPTS) {
        // Park permanently-failing items for review instead of hammering forever.
        await addConflict({
          entity: entry.entity,
          operation: entry.operation,
          payload: entry.payload,
          payloads: entry.payloads,
          targetId: entry.targetId,
          filter: entry.filter,
          update: entry.update,
          entries: entry.entries,
          tempId: entry.tempId,
          tempIds: entry.tempIds,
          baseUpdatedDate: entry.baseUpdatedDate,
          reason: "max_retries",
          lastError: (err && err.message) || String(err),
        });
        await removeQueue(entry.id);
        continue;
      }

      const delay = BACKOFF[Math.min(retry, BACKOFF.length - 1)];
      await updateEntry(entry.id, {
        retryCount: retry,
        lastError: (err && err.message) || String(err),
        nextAttemptAt: Date.now() + delay,
      });
      // continue trying the rest of the queue
    }
  }

  flushing = false;
  setStatus({ syncing: false });
  try { setStatus({ conflicts: (await getAllConflicts()).length }); } catch { /* ignore */ }

  if (succeeded > 0 && typeof window !== "undefined") {
    window.dispatchEvent(new Event("myspaza:synced"));
  }
  if (failed) {
    setTimeout(() => {
      flush();
    }, 30000);
  }
}

async function runOne(entry, tempMap) {
  const orig = accessor ? accessor(entry.entity) : null;
  if (!orig) throw new Error("Entity unavailable: " + entry.entity);

  const remap = (id) => tempMap[id] || id;

  switch (entry.operation) {
    case "create": {
      const res = await orig.create(entry.payload);
      if (entry.tempId && res && res.id) {
        tempMap[entry.tempId] = res.id;
        await setTempMap(entry.tempId, res.id);
      }
      break;
    }
    case "update": {
      const id = remap(entry.targetId);
      // Conflict check: fetch current server record before applying.
      if (entry.baseUpdatedDate) {
        let server;
        try {
          server = await orig.get(id);
        } catch (e) {
          // If the fetch itself is a network error, treat as transient failure (retry).
          throw e;
        }
        if (!server) {
          await parkConflict(entry, null, "deleted_on_server");
          return;
        }
        if (isServerNewer(server, entry.baseUpdatedDate)) {
          await parkConflict(entry, server, "edited_on_server");
          return;
        }
      }
      await orig.update(id, entry.payload);
      break;
    }
    case "delete": {
      const id = remap(entry.targetId);
      if (entry.baseUpdatedDate) {
        let server;
        try {
          server = await orig.get(id);
        } catch (e) {
          throw e;
        }
        if (server && isServerNewer(server, entry.baseUpdatedDate)) {
          await parkConflict(entry, server, "edited_on_server");
          return;
        }
        // If already gone on the server, the delete is a no-op success.
        if (!server) {
          break;
        }
      }
      await orig.delete(id);
      break;
    }
    case "bulkCreate": {
      const res = await orig.bulkCreate(entry.payloads);
      if (Array.isArray(res) && Array.isArray(entry.tempIds)) {
        res.forEach((r, i) => {
          if (entry.tempIds[i] && r && r.id) {
            tempMap[entry.tempIds[i]] = r.id;
            setTempMap(entry.tempIds[i], r.id);
          }
        });
      }
      break;
    }
    case "bulkUpdate": {
      const entries = (entry.entries || []).map((e) => ({ ...e, id: remap(e.id) }));
      await orig.bulkUpdate(entries);
      break;
    }
    case "updateMany":
      await orig.updateMany(entry.filter, entry.update);
      break;
    case "deleteMany":
      await orig.deleteMany(entry.filter);
      break;
    default:
      throw new Error("Unknown operation: " + entry.operation);
  }
}

function isServerNewer(server, baseUpdatedDate) {
  if (!server || !server.updated_date) return false;
  if (!baseUpdatedDate) return false;
  try {
    return new Date(server.updated_date).getTime() > new Date(baseUpdatedDate).getTime();
  } catch {
    return false;
  }
}

async function parkConflict(entry, serverSnapshot, reason) {
  await addConflict({
    entity: entry.entity,
    operation: entry.operation,
    payload: entry.payload,
    targetId: entry.targetId,
    baseUpdatedDate: entry.baseUpdatedDate,
    serverSnapshot,
    reason,
  });
  await removeQueue(entry.id);
  const err = new Error("conflict:" + reason);
  err.__conflict = true;
  throw err;
}

export function initSyncEngine() {
  if (typeof window === "undefined") return;
  window.addEventListener("online", () => setTimeout(flush, 500));
  // Flush anything left from a previous offline session.
  if (navigator.onLine) setTimeout(flush, 1500);
}
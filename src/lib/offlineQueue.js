// Pending write queue (IndexedDB) + temp-id mapping for offline-created records.
import { idbGetAll, idbSet, idbDel, idbGet, idbClear } from "./offlineStorage";
import { setStatus } from "./offlineStatus";

const QUEUE = "queue";
const TEMPIDS = "tempIds";

export function uid() {
  return "q_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

export function tempId() {
  return "tmp_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

export async function enqueue(entry) {
  const id = entry.id || uid();
  const full = { id, retryCount: 0, createdAt: Date.now(), ...entry };
  await idbSet(QUEUE, id, full);
  await refreshPending();
  return full;
}

export async function getQueue() {
  const all = await idbGetAll(QUEUE);
  return all.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

export async function removeQueue(id) {
  await idbDel(QUEUE, id);
  await refreshPending();
}

export async function updateEntry(id, patch) {
  const cur = await idbGet(QUEUE, id);
  if (!cur) return;
  await idbSet(QUEUE, id, { ...cur, ...patch });
  await refreshPending();
}

export async function clearQueue() {
  await idbClear(QUEUE);
  await refreshPending();
}

export async function refreshPending() {
  const all = await idbGetAll(QUEUE);
  setStatus({ pending: all.length });
}

// Map a temporary client id -> real server id once a queued create is synced.
export async function setTempMap(tmp, real) {
  await idbSet(TEMPIDS, tmp, real);
}
export async function getTempMap(tmp) {
  return await idbGet(TEMPIDS, tmp);
}
export async function clearTempMap(tmp) {
  await idbDel(TEMPIDS, tmp);
}
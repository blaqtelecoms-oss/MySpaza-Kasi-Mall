// IndexedDB-backed async persister for React Query.
// Separate database from the offline write-queue layer so query persistence
// is isolated and survives reloads, giving every page cache-first reads.
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";

const PERSISTER_DB = "myspaza_rq";
const STORE = "cache";
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const req = indexedDB.open(PERSISTER_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function store(mode) {
  const db = await openDB();
  if (!db) return null;
  try {
    return db.transaction(STORE, mode).objectStore(STORE);
  } catch {
    return null;
  }
}

export const idbPersister = {
  async getItem(key) {
    const os = await store("readonly");
    if (!os) return null;
    return new Promise((resolve) => {
      const r = os.get(key);
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => resolve(null);
    });
  },
  async setItem(key, value) {
    const os = await store("readwrite");
    if (!os) return;
    return new Promise((resolve) => {
      const r = os.put(value, key);
      r.onsuccess = () => resolve();
      r.onerror = () => resolve();
    });
  },
  async removeItem(key) {
    const os = await store("readwrite");
    if (!os) return;
    return new Promise((resolve) => {
      const r = os.delete(key);
      r.onsuccess = () => resolve();
      r.onerror = () => resolve();
    });
  },
};

export const queryPersister = createAsyncStoragePersister({
  storage: idbPersister,
  key: "myspaza-rq-cache",
  throttleTime: 1500,
});
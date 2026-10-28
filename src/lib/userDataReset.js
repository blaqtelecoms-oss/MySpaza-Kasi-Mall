// Device caches (offline read cache, queued writes, persisted React Query data)
// hold whatever the last signed-in account loaded. They are keyed per browser,
// not per account, so they are wiped whenever the signed-in identity changes:
// the next person on this device starts with an empty workspace instead of
// another account's records or queued writes.
import { queryClientInstance } from "@/lib/query-client";

const OWNER_KEY = "myspaza_cache_owner";

const DATABASES = [
  { name: "myspaza_offline", stores: ["collections", "queue", "tempIds", "conflicts"] },
  { name: "myspaza_rq", stores: ["cache"] },
];

const LOCAL_KEYS = ["myspaza_read_index"];

function readOwner() {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

function writeOwner(userId) {
  try {
    if (userId) localStorage.setItem(OWNER_KEY, userId);
    else localStorage.removeItem(OWNER_KEY);
  } catch {
    /* storage unavailable — nothing cached to protect */
  }
}

function clearDatabase({ name, stores }) {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve();
    let request;
    try {
      request = indexedDB.open(name);
    } catch {
      return resolve();
    }
    // The database did not exist yet, so there is nothing to clear.
    request.onupgradeneeded = () => resolve();
    request.onerror = () => resolve();
    request.onsuccess = () => {
      const db = request.result;
      const existing = stores.filter((store) => db.objectStoreNames.contains(store));
      if (existing.length === 0) {
        db.close();
        return resolve();
      }
      try {
        const tx = db.transaction(existing, "readwrite");
        existing.forEach((store) => tx.objectStore(store).clear());
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      } catch {
        db.close();
        resolve();
      }
    };
  });
}

/** Drop every cached record and pending write held on this device. */
export async function clearUserData() {
  try {
    queryClientInstance.clear();
  } catch {
    /* query client not ready */
  }
  LOCAL_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  });
  await Promise.all(DATABASES.map(clearDatabase));
}

/**
 * Keep the device cache aligned with the signed-in account: the first session
 * on this browser claims the cache, any other identity (including signed out)
 * wipes it.
 */
export async function syncCacheOwner(userId) {
  const next = userId || null;
  if (readOwner() === next) return;
  await clearUserData();
  writeOwner(next);
}

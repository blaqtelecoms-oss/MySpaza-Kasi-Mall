import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import { queryClientInstance } from "@/lib/query-client";

const PortalContext = createContext();

// The owner's choice lives in this browser session, so signing in again (or
// "Switch portal") asks again. A cashier's choice is also a row in the
// database: every app table policy checks that session, not this value.
const STORAGE_KEY = (userId) => `myspaza:portal:${userId}`;

function readStored(userId) {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStored(userId, value) {
  if (!userId) return;
  try {
    if (value) window.sessionStorage.setItem(STORAGE_KEY(userId), JSON.stringify(value));
    else window.sessionStorage.removeItem(STORAGE_KEY(userId));
  } catch {
    /* private mode: the in-memory state still works */
  }
}

export function PortalProvider({ children }) {
  const { user, shop } = useAuth();
  const [portal, setPortal] = useState(null);
  const [resolvedKey, setResolvedKey] = useState(null);

  const userId = user?.id || null;
  const key = userId && shop ? `${userId}:${shop.shopId}` : null;
  const loading = Boolean(key) && resolvedKey !== key;

  useEffect(() => {
    if (!userId) {
      setPortal(null);
      setResolvedKey(null);
      return;
    }
    if (!shop || !key) return;

    let active = true;

    async function resolve() {
      if (shop.isOwner) {
        const stored = readStored(userId);
        if (!active) return;
        setPortal(stored?.method === "owner" ? stored : null);
        setResolvedKey(key);
        return;
      }

      // An employee's open cashier session is recorded by the database, so a
      // reload (or a second tab) keeps them inside the portal they unlocked.
      let session = null;
      try {
        session = await api.shop.portalSession();
      } catch {
        session = null;
      }
      if (!active) return;
      setPortal(
        session?.method === "cashier" && session?.shop_id === shop.shopId
          ? { method: "cashier", shopId: session.shop_id, expiresAt: session.expires_at }
          : null
      );
      setResolvedKey(key);
    }

    resolve();
    return () => {
      active = false;
    };
  }, [userId, shop?.isOwner, shop?.shopId, key]);

  /** Owner portal: the account itself is the credential (verified in SQL too). */
  const openOwnerPortal = useCallback(
    async (shopId) => {
      const data = await api.shop.openOwnerPortal(shopId);
      const next = { method: "owner", shopId, expiresAt: data?.expires_at || null };
      writeStored(user?.id, next);
      setPortal(next);
      await queryClientInstance.invalidateQueries();
      return data;
    },
    [user?.id]
  );

  /** Cashier portal: the database checks this cashier's own password. */
  const openCashierPortal = useCallback(async (shopId, password) => {
    const data = await api.shop.openCashierPortal(shopId, password);
    if (data?.ok) {
      setPortal({ method: "cashier", shopId, expiresAt: data.expires_at });
      // The session is what lets the shop's tables through, so refetch them.
      await queryClientInstance.invalidateQueries();
    }
    return data;
  }, []);

  /** Leave the portal (and end the cashier session on this account). */
  const lockPortal = useCallback(async () => {
    try {
      await api.shop.closePortal();
    } catch {
      /* offline or signing out anyway: the client state still closes */
    }
    writeStored(user?.id, null);
    setPortal(null);
  }, [user?.id]);

  return (
    <PortalContext.Provider value={{ portal, loading, openOwnerPortal, openCashierPortal, lockPortal }}>
      {children}
    </PortalContext.Provider>
  );
}

export const usePortal = () => {
  const context = useContext(PortalContext);
  if (!context) throw new Error("usePortal must be used within a PortalProvider");
  return context;
};

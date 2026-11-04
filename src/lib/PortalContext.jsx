import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import { queryClientInstance } from "@/lib/query-client";

const PortalContext = createContext();

/**
 * The portal a session has open. Both portals are password-gated in the
 * database and recorded in `shop_portal_session`, so a reload (or a second tab)
 * stays where the person was and the app's table policies can see the choice.
 */
function fromSession(session) {
  if (!session?.method) return null;
  return {
    method: session.method,
    shopId: session.shop_id,
    cashierId: session.cashier_id || null,
    cashierName: session.cashier_name || null,
    role: session.cashier_role || null,
    permissions: session.cashier_permissions || null,
    expiresAt: session.expires_at || null,
  };
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
      return undefined;
    }
    if (!shop || !key) return undefined;

    let active = true;

    (async () => {
      let session = null;
      try {
        session = await api.shop.portalSession();
      } catch {
        session = null;
      }
      if (!active) return;
      const next = fromSession(session);
      setPortal(next && next.shopId === shop.shopId ? next : null);
      setResolvedKey(key);
    })();

    return () => {
      active = false;
    };
  }, [userId, shop?.shopId, key]);

  /** Owner portal: opens only with the store's own portal password. */
  const openOwnerPortal = useCallback(async (shopId, password) => {
    const data = await api.shop.openOwnerPortal(shopId, password);
    if (data?.ok) {
      setPortal({
        method: "owner",
        shopId,
        cashierId: null,
        cashierName: null,
        role: null,
        permissions: null,
        expiresAt: data.expires_at || null,
      });
      api.audit
        .log({ shopId, category: "portal", action: "portal_open", summary: "Opened the owner portal" })
        .catch(() => {});
      await queryClientInstance.invalidateQueries();
    }
    return data;
  }, []);

  /** Cashier portal: opens only with the chosen portal's own password. */
  const openCashierPortal = useCallback(async (shopId, cashierId, password) => {
    const data = await api.shop.openCashierPortal(shopId, cashierId, password);
    if (data?.ok) {
      setPortal({
        method: "cashier",
        shopId,
        cashierId: data.cashier_id || cashierId,
        cashierName: data.cashier_name || null,
        role: data.cashier_role || null,
        permissions: data.cashier_permissions || null,
        expiresAt: data.expires_at || null,
      });
      // The session is what lets the shop's tables through, so refetch them.
      const role = data.cashier_role || "cashier";
      api.audit
        .log({
          shopId,
          category: "portal",
          action: "portal_open",
          summary: `Opened the ${role} portal${data.cashier_name ? ` · ${data.cashier_name}` : ""}`,
        })
        .catch(() => {});
      await queryClientInstance.invalidateQueries();
    }
    return data;
  }, []);

  /** Leave the portal (and end its session in the database). */
  const lockPortal = useCallback(async () => {
    // Logged before the session closes, so the entry names the portal and role
    // that were actually open.
    if (shop?.shopId) {
      api.audit
        .log({
          shopId: shop.shopId,
          category: "portal",
          action: "portal_close",
          summary: portal?.method === "cashier" ? `Closed the ${portal.role || "cashier"} portal` : "Closed the owner portal",
        })
        .catch(() => {});
    }
    try {
      await api.shop.closePortal();
    } catch {
      /* offline or signing out anyway: the client state still closes */
    }
    setPortal(null);
  }, [shop?.shopId, portal]);

  return (
    <PortalContext.Provider value={{ portal, loading, openOwnerPortal, openCashierPortal, lockPortal }}>
      {children}
    </PortalContext.Provider>
  );
};

export const usePortal = () => {
  const context = useContext(PortalContext);
  if (!context) throw new Error("usePortal must be used within a PortalProvider");
  return context;
};

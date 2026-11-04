import { useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { usePortal } from "@/lib/PortalContext";
import { portalPermissions } from "@/lib/portalAccess";
import { moduleLevel } from "@/lib/modules";

const fromMap = (permissions, module) => {
  const level = moduleLevel(permissions, module);
  return level === 2 ? "edit" : level === 1 ? "view" : "none";
};

/**
 * The access the signed-in session holds for one module: `"edit"`, `"view"` or
 * `"none"` (src/lib/modules.js).
 *
 * - A cashier or supervisor portal is governed only by the rules the owner set
 *   on that portal, even when it is opened on the store's own account.
 * - The store's owner portal, and an owner account outside a staff portal, may
 *   change everything.
 * - An employee account uses the modules the owner granted it.
 *
 * Postgres enforces the same three levels (`shop_module_level()` and the table
 * policies), so this hook only hides controls the database would refuse.
 */
export function useModuleAccess() {
  const { shop } = useAuth();
  const { portal } = usePortal();

  const level = useCallback(
    (module) => {
      if (portal?.method === "cashier") return fromMap(portalPermissions(portal), module);
      if (portal?.method === "owner" || shop?.isOwner) return "edit";
      return fromMap(shop?.permissions, module);
    },
    [portal, shop]
  );

  const canView = useCallback((module) => level(module) !== "none", [level]);
  const canEdit = useCallback((module) => level(module) === "edit", [level]);

  return { level, canView, canEdit };
}

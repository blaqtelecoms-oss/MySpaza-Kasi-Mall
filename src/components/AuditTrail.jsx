import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { api } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import { MODULE_LABELS } from "@/lib/modules";
import { moduleForPath } from "@/lib/portalAccess";

// Owner-only screens that are not tied to a module key, so the log can still
// name them in plain language.
const EXTRA_LABELS = {
  "/": "Dashboard",
  "/employees": "Employees",
  "/settings": "Settings",
  "/audit-log": "Audit log",
};

const labelFor = (pathname, module) => EXTRA_LABELS[pathname] || MODULE_LABELS[module] || pathname;

/**
 * Records each screen a person opens in the shop's audit log. The database
 * stamps who opened it (account, shop role and open portal); this only reports
 * the visit, so the log never depends on the screen itself remembering to.
 */
export default function AuditTrail() {
  const { shop } = useAuth();
  const { pathname } = useLocation();
  const lastRef = useRef(null);

  useEffect(() => {
    if (!shop?.shopId || !pathname) return;
    const key = `${shop.shopId}:${pathname}`;
    if (lastRef.current === key) return;
    lastRef.current = key;

    const module = moduleForPath(pathname);
    api.audit
      .log({
        shopId: shop.shopId,
        category: "page",
        action: "page_view",
        module,
        path: pathname,
        summary: `Opened ${labelFor(pathname, module)}`,
      })
      .catch(() => {
        /* offline or between sessions: a missing visit is not worth a toast */
      });
  }, [pathname, shop?.shopId]);

  return null;
}

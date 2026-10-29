import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useSubscription } from "@/lib/SubscriptionContext";
import UpgradeRequired from "@/components/UpgradeRequired";

/**
 * Screens that belong to the shop owner only (Employees, Settings). An employee
 * hitting the URL is sent back to the dashboard; the database refuses the writes
 * behind these screens regardless.
 */
export function RequireOwner({ children }) {
  const { shop } = useAuth();
  if (!shop) return null;
  if (!shop.isOwner) return <Navigate to="/" replace />;
  return children;
}

/** Screens that need one granted module, e.g. `module="inventory"`. */
export function RequireModule({ module, children }) {
  const { shop, can } = useAuth();
  if (!shop) return null;
  if (!can(module)) return <Navigate to="/" replace />;
  return children;
}

/**
 * Screens the shop's plan includes, e.g. `feature="debtors"`. Nothing is hidden
 * from the menu: a page above the plan stays clickable and renders the paywall
 * in place of itself.
 */
export function RequirePlan({ feature, children }) {
  const { shop } = useAuth();
  const { canUse } = useSubscription();
  if (!shop) return null;
  if (canUse(feature)) return children;
  return <UpgradeRequired feature={feature} />;
}

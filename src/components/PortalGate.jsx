import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { usePortal } from "@/lib/PortalContext";
import { canCashierOpen } from "@/lib/portalAccess";

/**
 * After signing in, the app asks which store and portal the person is opening.
 * Nothing inside the shell renders until that choice is made, and the password
 * behind it is checked in the database.
 */
export default function PortalGate({ children }) {
  const { shop } = useAuth();
  const { portal, loading } = usePortal();
  const location = useLocation();

  // Signed out (or no membership yet): the route guards handle that.
  if (!shop) return children;

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-green-50">
        <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!portal) return <Navigate to="/portal" replace />;
  if (portal.shopId !== shop.shopId) return <Navigate to="/portal" replace />;

  // The cashier portal is the till, not the shop: the owner screens stay shut
  // until the owner portal's password is entered.
  if (portal.method === "cashier" && !canCashierOpen(location.pathname)) {
    return <Navigate to="/pos" replace />;
  }

  return children;
}

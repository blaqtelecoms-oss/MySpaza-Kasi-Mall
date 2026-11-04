import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { usePortal } from "@/lib/PortalContext";

/**
 * After signing in, the app asks which store and portal the person is opening.
 * Nothing inside the shell renders until that choice is made, and a cashier's
 * choice only counts while the database session for it is open.
 */
export default function PortalGate({ children }) {
  const { shop } = useAuth();
  const { portal, loading } = usePortal();

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
  if (portal.method === "cashier" && portal.shopId !== shop.shopId) {
    return <Navigate to="/portal" replace />;
  }

  return children;
}

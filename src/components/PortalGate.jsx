import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { usePortal } from "@/lib/PortalContext";
import { portalCanOpen, portalHomePath } from "@/lib/portalAccess";

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

  // A cashier or supervisor portal only opens the screens the owner granted
  // it; everything else goes back to the portal's landing screen.
  if (portal.method === "cashier" && !portalCanOpen(portal, location.pathname)) {
    const home = portalHomePath(portal);
    if (location.pathname === home) return children;
    return <Navigate to={home} replace />;
  }

  return children;
}

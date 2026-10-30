import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

/**
 * First-run setup. An owner who has not been through the welcome flow (business
 * profile + a plan choice) is sent there before any app screen, so typing a URL
 * cannot skip it. Employees join a shop that already exists and never see it.
 */
export default function OnboardingGate({ children }) {
  const { shop } = useAuth();
  const location = useLocation();

  if (shop?.isOwner && !shop.onboardedAt) {
    // The search string is kept: a returning Yoco payment is confirmed from it.
    return <Navigate to={{ pathname: "/onboarding", search: location.search }} replace />;
  }

  return children;
}

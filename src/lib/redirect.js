import { useSearchParams } from "react-router-dom";

/**
 * The in-app page to land on after signing in, from `?next=`. Invitation links
 * send people here so they return to the invitation once authenticated. Only
 * same-site paths are honoured, so a crafted link cannot bounce a fresh sign-in
 * to another site.
 */
export function useNextPath() {
  const [params] = useSearchParams();
  const next = params.get("next") || "";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

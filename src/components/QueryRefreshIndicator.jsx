// Lightweight "Refreshing…" / "Showing cached data" affordance shown next to a
// page header instead of a full-screen blocking spinner when cached data exists.
import { RefreshCw, CloudOff } from "lucide-react";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";

export default function QueryRefreshIndicator({ isFetching, hasData }) {
  const status = useOfflineStatus();
  if (!hasData) return null;
  if (isFetching) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
        <RefreshCw size={11} className="animate-spin" /> Refreshing…
      </span>
    );
  }
  if (!status.online) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-amber-600">
        <CloudOff size={11} /> Showing cached data
      </span>
    );
  }
  return null;
}
import { useState } from "react";
import { WifiOff, CloudUpload, RefreshCw, AlertTriangle } from "lucide-react";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import OfflineConflictsReview from "@/components/OfflineConflictsReview";

// Slim, non-intrusive app-wide banner. Shows only when offline or when there are
// pending changes/conflicts, and reflects the current sync state.
export default function OfflineBanner() {
  const { online, pending, syncing, conflicts } = useOfflineStatus();
  const [reviewOpen, setReviewOpen] = useState(false);

  if (online && pending === 0 && conflicts === 0) return null;

  const offline = !online;

  return (
    <>
      <div
        className={`flex items-center gap-2 px-4 py-1.5 text-xs font-medium border-b select-none ${
          offline
            ? "bg-amber-50 text-amber-800 border-amber-200"
            : "bg-green-50 text-green-800 border-green-200"
        }`}
      >
        {offline ? (
          <WifiOff size={14} className="shrink-0" />
        ) : syncing ? (
          <RefreshCw size={14} className="shrink-0 animate-spin" />
        ) : (
          <CloudUpload size={14} className="shrink-0" />
        )}
        <span className="truncate">
          {offline
            ? "Offline — showing cached data"
            : syncing
              ? `Syncing ${pending} change${pending === 1 ? "" : "s"}…`
              : `${pending} change${pending === 1 ? "" : "s"} queued to sync`}
        </span>

        {conflicts > 0 && (
          <button
            onClick={() => setReviewOpen(true)}
            className="ml-auto flex items-center gap-1 shrink-0 rounded-full bg-amber-100 text-amber-900 px-2 py-1 text-[11px] font-semibold hover:bg-amber-200 transition-colors"
          >
            <AlertTriangle size={12} />
            {conflicts} need review
          </button>
        )}
      </div>

      <OfflineConflictsReview open={reviewOpen} onOpenChange={setReviewOpen} />
    </>
  );
}
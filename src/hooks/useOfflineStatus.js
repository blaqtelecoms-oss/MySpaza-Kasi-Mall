import { useSyncExternalStore } from "react";
import { subscribe, getStatus } from "@/lib/offlineStatus";

// Reactive offline + sync status for the app-wide banner and any screen that needs it.
export function useOfflineStatus() {
  return useSyncExternalStore(subscribe, getStatus, getStatus);
}
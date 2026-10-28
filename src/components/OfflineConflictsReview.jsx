import { useEffect, useState, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, RotateCw, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  getAllConflicts, removeConflict, clearConflicts,
} from "@/lib/offlineStorage";
import { enqueue } from "@/lib/offlineQueue";
import { setStatus } from "@/lib/offlineStatus";
import { flush } from "@/lib/syncEngine";

const REASON_LABEL = {
  edited_on_server: "Server record changed",
  deleted_on_server: "No longer on server",
  max_retries: "Failed repeatedly",
};

function describe(c) {
  if (c.operation === "update" || c.operation === "delete") return c.targetId || "—";
  if (c.operation === "create") return c.payload?.name || c.payload?.title || "New record";
  return c.entity;
}

export default function OfflineConflictsReview({ open, onOpenChange }) {
  const [conflicts, setConflicts] = useState([]);
  const [busy, setBusy] = useState(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const list = await getAllConflicts();
    setConflicts(list);
    setStatus({ conflicts: list.length });
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const retry = async (c) => {
    setBusy(c.id);
    try {
      // Re-queue the original operation, then drop the parked conflict and flush.
      const entry = {
        operation: c.operation,
        entity: c.entity,
        payload: c.payload,
        payloads: c.payloads,
        targetId: c.targetId,
        filter: c.filter,
        update: c.update,
        entries: c.entries,
        tempId: c.tempId,
        tempIds: c.tempIds,
        baseUpdatedDate: c.baseUpdatedDate,
      };
      await enqueue(entry);
      await removeConflict(c.id);
      await load();
      toast({ title: "Re-queued", description: "Syncing your change now." });
      flush();
    } catch (e) {
      toast({ title: "Couldn't retry", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const discard = async (c) => {
    setBusy(c.id);
    try {
      await removeConflict(c.id);
      await load();
      toast({ title: "Discarded", description: "The change was removed from review." });
    } finally {
      setBusy(null);
    }
  };

  const clearAll = async () => {
    await clearConflicts();
    await load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="text-amber-600" size={18} />
            Changes needing review
          </DialogTitle>
          <DialogDescription>
            These edits couldn't sync automatically because the server record changed
            or the save kept failing. Retry to push again, or discard to remove them.
          </DialogDescription>
        </DialogHeader>

        {conflicts.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No conflicts — everything is in sync.
          </p>
        ) : (
          <ScrollArea className="max-h-[55vh] -mx-2 px-2">
            <ul className="space-y-2">
              {conflicts.map((c) => (
                <li key={c.id} className="rounded-lg border p-3 bg-muted/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {c.entity} · {c.operation}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{describe(c)}</p>
                      <p className="text-xs text-amber-700 mt-1">
                        {REASON_LABEL[c.reason] || c.reason}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm" variant="outline"
                        onClick={() => retry(c)} disabled={busy === c.id}
                        className="h-11 px-3"
                      >
                        <RotateCw size={14} /> Retry
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => discard(c)} disabled={busy === c.id}
                        className="h-11 px-3 text-destructive hover:text-destructive"
                      >
                        <Trash2 size={14} /> Discard
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}

        {conflicts.length > 0 && (
          <DialogFooter className="justify-between sm:justify-between">
            <Button variant="ghost" onClick={clearAll} className="h-11">
              Discard all
            </Button>
            <Button onClick={() => onOpenChange(false)} className="h-11">Done</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
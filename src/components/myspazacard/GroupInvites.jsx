import { useState } from "react";
import { api } from "@/api/client";
import { useEntityQuery, useInvalidateEntity } from "@/hooks/useEntityQuery";
import { Loader2, RotateCw, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

const KIND_LABELS = {
  stokvel: "stokvel",
  savings_group: "savings group",
  bulk_buy: "bulk buy",
};

/**
 * Invite a friend to one group — a stokvel, a savings group or a bulk buy — and
 * manage the invitations still waiting. The email is sent by the app's server
 * through Resend, so the link is never constructed in the browser.
 */
export default function GroupInvites({ groupKind, groupId, groupName }) {
  const invitesQuery = useEntityQuery("GroupInvite", "filter", [
    { group_kind: groupKind, group_id: groupId, accepted_at: null },
  ]);
  const invalidate = useInvalidateEntity();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const { toast } = useToast();

  const pending = (invitesQuery.data || []).filter(
    (invite) => !invite.accepted_at && (!invite.expires_at || new Date(invite.expires_at) > new Date())
  );
  const refresh = () => invalidate("GroupInvite");

  const resend = async (invite) => {
    if (busyId) return;
    setBusyId(invite.id);
    try {
      await api.groups.invite({ email: invite.email, groupKind, groupId });
      refresh();
      toast({ title: "Invitation resent", description: `A fresh link is on its way to ${invite.email}.` });
    } catch (error) {
      toast({ title: "Could not resend", description: error.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (invite) => {
    if (busyId) return;
    setBusyId(invite.id);
    try {
      await api.entities.GroupInvite.delete(invite.id);
      refresh();
      toast({ title: "Invitation cancelled", description: `${invite.email} can no longer use that link.` });
    } catch (error) {
      toast({ title: "Could not cancel", description: error.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mt-3 border-t pt-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-gray-500">Invitations</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-[11px] text-green-700 border-green-200"
          onClick={() => setOpen(true)}
        >
          <UserPlus size={13} /> Invite
        </Button>
      </div>

      {pending.length === 0 ? (
        <p className="mt-1 text-[11px] text-gray-400">No one invited yet.</p>
      ) : (
        <div className="mt-1 space-y-1">
          {pending.map((invite) => (
            <div key={invite.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-gray-600">{invite.email}</span>
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => resend(invite)}
                  disabled={busyId === invite.id}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                  aria-label={`Resend invitation to ${invite.email}`}
                >
                  {busyId === invite.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
                </button>
                <button
                  type="button"
                  onClick={() => cancel(invite)}
                  disabled={busyId === invite.id}
                  className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  aria-label={`Cancel invitation for ${invite.email}`}
                >
                  <Trash2 size={12} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {open && (
        <InviteGroupMemberDialog
          groupKind={groupKind}
          groupId={groupId}
          groupName={groupName}
          onClose={() => setOpen(false)}
          onSent={refresh}
        />
      )}
    </div>
  );
}

function InviteGroupMemberDialog({ groupKind, groupId, groupName, onClose, onSent }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();
  const label = KIND_LABELS[groupKind] || "group";

  const send = async () => {
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      toast({ title: "Enter a valid email address", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      await api.groups.invite({ email: address, groupKind, groupId });
      toast({ title: "Invitation sent", description: `${address} will get an email with a link to join.` });
      onSent?.();
      onClose();
    } catch (error) {
      toast({ title: "Could not send the invitation", description: error.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite to {groupName || label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Friend's email address *</Label>
            <Input
              className="mt-1"
              type="email"
              inputMode="email"
              placeholder="friend@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") send();
              }}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              They get an email from Resend with a link to join this {label}. The link works once and
              expires in 7 days.
            </p>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={send} disabled={sending} className="flex-1 gap-2 bg-green-600 hover:bg-green-700">
              {sending ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              {sending ? "Sending…" : "Send invite"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

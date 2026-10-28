import { useMemo, useState } from "react";
import { api } from "@/api/client";
import { useEntityQuery, useInvalidateEntity } from "@/hooks/useEntityQuery";
import { Plus, UserCheck, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import InviteEmployeeDialog from "@/components/employees/InviteEmployeeDialog";
import EditEmployeeDialog from "@/components/employees/EditEmployeeDialog";
import { EmployeeCard, PendingInviteCard } from "@/components/employees/EmployeeCard";

/**
 * Shop owner's team screen: who can sign in to this shop, what each of them may
 * use, and the invitations still waiting to be accepted. Employees never reach
 * this screen (owner-only route), and the database only lets the owner change
 * membership.
 */
export default function Employees() {
  const membersQuery = useEntityQuery("ShopMember", "filter", [{ status: "active" }]);
  const invitesQuery = useEntityQuery("ShopInvite", "filter", [{ accepted_at: null }]);
  const invalidate = useInvalidateEntity();

  const members = membersQuery.data || [];
  const invites = useMemo(
    () =>
      (invitesQuery.data || []).filter(
        (invite) => !invite.accepted_at && (!invite.expires_at || new Date(invite.expires_at) > new Date())
      ),
    [invitesQuery.data]
  );

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const { toast } = useToast();

  const refresh = () => {
    invalidate("ShopMember");
    invalidate("ShopInvite");
  };

  const withEditAccess = members.filter((member) =>
    Object.values(member.permissions || {}).includes("edit")
  ).length;

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      await api.shop.removeMember(revokeTarget.id);
      refresh();
      toast({ title: "Access removed", description: `${revokeTarget.member_email} can no longer open this shop.` });
    } catch (err) {
      toast({ title: "Could not remove access", description: err.message, variant: "destructive" });
    } finally {
      setRevokeTarget(null);
    }
  };

  const handleCancelInvite = async () => {
    if (!cancelTarget) return;
    try {
      await api.entities.ShopInvite.delete(cancelTarget.id);
      refresh();
      toast({ title: "Invitation cancelled", description: `${cancelTarget.email} can no longer use that link.` });
    } catch (err) {
      toast({ title: "Could not cancel the invitation", description: err.message, variant: "destructive" });
    } finally {
      setCancelTarget(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground">
            {members.length} staff · {invites.length} invited · {withEditAccess} with edit access
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="gap-2 bg-green-600 hover:bg-green-700">
          <Plus size={18} /> Add Employee
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-muted border-border">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{members.length}</p>
            <p className="text-xs text-muted-foreground">Total Staff</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">{withEditAccess}</p>
            <p className="text-xs text-green-600 dark:text-green-400">Can Edit</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{invites.length}</p>
            <p className="text-xs text-amber-700 dark:text-amber-400">Invited</p>
          </CardContent>
        </Card>
      </div>

      {members.length === 0 && invites.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <UserCheck size={26} className="text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">No employees yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Invite your team by email. Each person signs in and sees your shop with only the
                modules you allow.
              </p>
            </div>
            <Button onClick={() => setInviteOpen(true)} className="gap-2 bg-green-600 hover:bg-green-700">
              <Plus size={18} /> Invite your first employee
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {members.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {members.map((member) => (
                <EmployeeCard
                  key={member.id}
                  member={member}
                  onEdit={setEditMember}
                  onRevoke={setRevokeTarget}
                />
              ))}
            </div>
          )}

          {invites.length > 0 && (
            <div className="space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Mail size={16} /> Pending invitations
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {invites.map((invite) => (
                  <PendingInviteCard key={invite.id} invite={invite} onCancel={setCancelTarget} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
        <ShieldCheck size={15} className="mt-0.5 shrink-0" />
        <p>
          Employees only see what you grant them, in the menu and in the data. They can never open
          Employees or Settings, and you can change or remove their access at any time.
        </p>
      </div>

      <InviteEmployeeDialog open={inviteOpen} onOpenChange={setInviteOpen} onSent={refresh} />

      <EditEmployeeDialog
        member={editMember}
        open={Boolean(editMember)}
        onOpenChange={(open) => !open && setEditMember(null)}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Remove employee access"
        description={`${revokeTarget?.member_email || "This employee"} will lose access to your shop immediately. You can invite them again later.`}
        onConfirm={handleRevoke}
        confirmLabel="Remove access"
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel invitation"
        description={`The invitation link sent to ${cancelTarget?.email || "this address"} will stop working.`}
        onConfirm={handleCancelInvite}
        confirmLabel="Cancel invitation"
      />
    </div>
  );
}

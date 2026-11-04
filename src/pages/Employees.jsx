import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import { useEntityQuery, useInvalidateEntity } from "@/hooks/useEntityQuery";
import { Loader2, ShieldCheck, ShoppingBasket, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import EditEmployeeDialog from "@/components/employees/EditEmployeeDialog";
import EditCashierDialog from "@/components/employees/EditCashierDialog";
import CashierCard from "@/components/employees/CashierCard";
import OwnerPortalPasswordCard from "@/components/employees/OwnerPortalPasswordCard";
import { EmployeeCard } from "@/components/employees/EmployeeCard";

/**
 * The store owner's access screen: the owner portal's own password, the three
 * cashier portals the store starts with, and the names and passwords behind
 * each one. Every password is checked by the database when a portal opens, so
 * this screen only sets them.
 */
export default function Employees() {
  const membersQuery = useEntityQuery("ShopMember", "filter", [{ status: "active" }]);
  const invalidate = useInvalidateEntity();
  const members = membersQuery.data || [];

  const [editMember, setEditMember] = useState(null);
  const [editCashier, setEditCashier] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const { toast } = useToast();
  const { shop } = useAuth();

  // This store's three cashiers and whether its owner portal has a password.
  const { data: options, refetch: refetchOptions } = useQuery({
    queryKey: ["portal-options", shop?.shopId],
    queryFn: () => api.shop.portalOptions(shop.shopId),
    enabled: Boolean(shop?.shopId),
  });

  const cashiers = options?.cashiers || [];
  const readyCount = cashiers.filter((cashier) => cashier.has_password).length;

  const refresh = () => {
    invalidate("ShopMember");
    refetchOptions();
  };

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

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Employees</h1>
        <p className="text-sm text-muted-foreground">
          {readyCount} of {cashiers.length || 3} cashier portals ready
          {members.length > 0 ? ` · ${members.length} staff login${members.length === 1 ? "" : "s"}` : ""}
        </p>
      </div>

      <OwnerPortalPasswordCard
        shopId={shop?.shopId}
        hasPassword={Boolean(options?.owner_password_set)}
        onSaved={refetchOptions}
      />

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShoppingBasket size={16} /> Cashier portals
        </h2>
        {options === null || options === undefined ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Loading cashiers…
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cashiers.map((cashier) => (
              <CashierCard key={cashier.id} cashier={cashier} onEdit={setEditCashier} />
            ))}
          </div>
        )}
      </section>

      {members.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users size={16} /> Staff logins
          </h2>
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
        </section>
      )}

      <Card>
        <CardContent className="flex items-start gap-2 p-3 text-xs text-muted-foreground">
          <ShieldCheck size={15} className="mt-0.5 shrink-0" />
          <p>
            Each cashier picks their own name on the portal screen and types their password. The
            owner portal has its own password, so a till left open never shows the shop's takings,
            staff or settings. Changing a password closes any portal already open on it.
          </p>
        </CardContent>
      </Card>

      <EditCashierDialog
        cashier={editCashier}
        open={Boolean(editCashier)}
        onOpenChange={(open) => !open && setEditCashier(null)}
        onSaved={refresh}
      />

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
        description={`${revokeTarget?.member_email || "This employee"} will lose access to your shop immediately.`}
        onConfirm={handleRevoke}
        confirmLabel="Remove access"
      />
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import { useSubscription } from "@/lib/SubscriptionContext";
import { useEntityQuery, useInvalidateEntity } from "@/hooks/useEntityQuery";
import { Loader2, Plus, ShieldCheck, ShoppingBasket, UserCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { PLAN_BY_KEY, nextPlanKey, staffLimit } from "@/lib/plans";
import { roleLabel } from "@/lib/portalAccess";
import ConfirmDialog from "@/components/ConfirmDialog";
import EditEmployeeDialog from "@/components/employees/EditEmployeeDialog";
import EditCashierDialog from "@/components/employees/EditCashierDialog";
import AddCashierDialog from "@/components/employees/AddCashierDialog";
import CashierCard from "@/components/employees/CashierCard";
import OwnerPortalPasswordCard from "@/components/employees/OwnerPortalPasswordCard";
import { EmployeeCard } from "@/components/employees/EmployeeCard";

/** "1 of 2 cashiers" · "3 cashiers · Unlimited" · "2 cashiers (plan covers 1)". */
function allowanceLabel(count, limit, role) {
  const noun = role === "supervisor" ? "supervisor" : "cashier";
  if (limit === null || limit === undefined) return `${count} ${noun}${count === 1 ? "" : "s"} · Unlimited`;
  if (count > limit) return `${count} ${noun}${count === 1 ? "" : "s"} (plan covers ${limit})`;
  return `${count} of ${limit} ${noun}${limit === 1 ? "" : "s"}`;
}

/**
 * The store owner's access screen: the owner portal's own password, the cashier
 * and supervisor portals the store runs, and the screens, names and passwords
 * behind each one. Every password is checked by the database when a portal
 * opens, and so is the plan's allowance of cashiers and supervisors.
 */
export default function Employees() {
  const { shop } = useAuth();
  const { plan, canUse, openCheckout } = useSubscription();
  // Staff logins are a Premium feature; the till portals are not, because every
  // store rings up sales on the plan it has.
  const showStaffLogins = canUse("employees");
  const membersQuery = useEntityQuery("ShopMember", "filter", [{ status: "active" }], {
    enabled: showStaffLogins,
  });
  const invalidate = useInvalidateEntity();
  const members = showStaffLogins ? membersQuery.data || [] : [];

  const [editMember, setEditMember] = useState(null);
  const [editCashier, setEditCashier] = useState(null);
  const [addRole, setAddRole] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const { toast } = useToast();

  // This store's portals, whether its owner portal has a password, and the
  // plan's allowance (the database's numbers, not a client guess).
  const { data: options, refetch: refetchOptions } = useQuery({
    queryKey: ["portal-options", shop?.shopId],
    queryFn: () => api.shop.portalOptions(shop.shopId),
    enabled: Boolean(shop?.shopId),
  });

  const staff = options?.cashiers || [];
  const cashiers = staff.filter((portal) => portal.role !== "supervisor");
  const supervisors = staff.filter((portal) => portal.role === "supervisor");
  const readyCount = staff.filter((portal) => portal.has_password).length;

  // `staff_limits` says `null` for Ultra's unlimited allowance, so it is read by
  // key rather than with `??` (which would treat unlimited as "not set").
  const limitFor = (role) => {
    const limits = options?.staff_limits;
    if (limits && role in limits) return limits[role];
    return staffLimit(plan, role);
  };
  const nextPlan = nextPlanKey(plan);

  const refresh = () => {
    invalidate("ShopMember");
    refetchOptions();
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    try {
      await api.shop.removeCashier(removeTarget.id);
      refresh();
      toast({ title: "Portal removed", description: `${removeTarget.full_name} can no longer open this store.` });
    } catch (err) {
      toast({ title: "Could not remove this portal", description: err.message, variant: "destructive" });
    } finally {
      setRemoveTarget(null);
    }
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

  const renderSection = (role, portals) => {
    const limit = limitFor(role);
    const label = role === "supervisor" ? "Supervisors" : "Cashiers";
    const full = limit !== null && limit !== undefined && portals.length >= limit;
    return (
      <section className="space-y-2" key={role}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {role === "supervisor" ? <UserCheck size={16} /> : <ShoppingBasket size={16} />}
            {label}
            <span className="text-xs font-normal text-muted-foreground">
              {allowanceLabel(portals.length, limit, role)}
            </span>
          </h2>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={full}
            onClick={() => setAddRole(role)}
          >
            <Plus size={14} /> Add {role}
          </Button>
        </div>

        {portals.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {portals.map((portal) => (
              <CashierCard
                key={portal.id}
                cashier={portal}
                onEdit={setEditCashier}
                onRemove={portals.length > 1 ? setRemoveTarget : null}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
            {role === "supervisor"
              ? "No supervisor portal yet. A supervisor also sees the cash up and the day's numbers."
              : "No cashier portal yet. Add one to put someone on the till."}
          </p>
        )}

        {full && (
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {limit === 0
              ? `Your ${PLAN_BY_KEY[plan]?.name} plan doesn't include a supervisor portal.`
              : `${PLAN_BY_KEY[plan]?.name} covers ${limit} ${role}${limit === 1 ? "" : "s"}.`}
            {nextPlan ? (
              <Button
                size="sm"
                variant="link"
                className="h-auto p-0 text-xs"
                onClick={() => openCheckout(nextPlan)}
              >
                Upgrade to {PLAN_BY_KEY[nextPlan]?.name} for more
              </Button>
            ) : (
              <span>Remove one to make room.</span>
            )}
          </p>
        )}
      </section>
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Employees</h1>
        <p className="text-sm text-muted-foreground">
          {readyCount} of {staff.length} staff portals ready
          {members.length > 0 ? ` · ${members.length} staff login${members.length === 1 ? "" : "s"}` : ""}
        </p>
      </div>

      <OwnerPortalPasswordCard
        shopId={shop?.shopId}
        hasPassword={Boolean(options?.owner_password_set)}
        onSaved={refetchOptions}
      />

      {options === null || options === undefined ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Loading staff portals…
        </p>
      ) : (
        <>
          {renderSection("cashier", cashiers)}
          {(limitFor("supervisor") !== 0 || supervisors.length > 0) &&
            renderSection("supervisor", supervisors)}
        </>
      )}

      {showStaffLogins && members.length > 0 && (
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
            Each person picks their own name on the portal screen and types their password. The
            owner portal has its own password, so a till left open never shows the shop's takings,
            staff or settings. Changing a portal's access or password closes it.
          </p>
        </CardContent>
      </Card>

      <EditCashierDialog
        cashier={editCashier}
        open={Boolean(editCashier)}
        onOpenChange={(open) => !open && setEditCashier(null)}
        onSaved={refresh}
      />

      <AddCashierDialog
        shopId={shop?.shopId}
        role={addRole || "cashier"}
        open={Boolean(addRole)}
        onOpenChange={(open) => !open && setAddRole(null)}
        onSaved={refresh}
      />

      <EditEmployeeDialog
        member={editMember}
        open={Boolean(editMember)}
        onOpenChange={(open) => !open && setEditMember(null)}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={`Remove ${roleLabel(removeTarget?.role).toLowerCase()} portal`}
        description={`${removeTarget?.full_name || "This portal"} will lose access immediately, and its password is deleted.`}
        onConfirm={handleRemove}
        confirmLabel="Remove portal"
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

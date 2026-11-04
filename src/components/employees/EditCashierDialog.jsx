import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { cleanPermissions } from "@/lib/modules";
import { STAFF_ROLES, roleLabel, rolePermissions } from "@/lib/portalAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MobileSelect } from "@/components/ui/mobile-select";
import { useToast } from "@/components/ui/use-toast";
import { KeyRound, Loader2, Save } from "lucide-react";
import PermissionEditor from "@/components/employees/PermissionEditor";

const sameRules = (a, b) =>
  JSON.stringify(cleanPermissions(a)) === JSON.stringify(cleanPermissions(b));

/**
 * Owner edits one staff portal: its name, whether it is a cashier or a
 * supervisor, the screens it may open, and its own portal password. The password
 * only ever leaves the browser for the database function that hashes it.
 */
export default function EditCashierDialog({ cashier, open, onOpenChange, onSaved }) {
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("cashier");
  const [permissions, setPermissions] = useState({});
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!cashier) return;
    setFullName(cashier.full_name || "");
    setRole(cashier.role || "cashier");
    setPermissions({ ...(cashier.permissions || rolePermissions(cashier.role)) });
    setPassword("");
  }, [cashier]);

  const changeRole = (nextRole) => {
    // Untouched rules follow the new role's preset; hand-edited ones are kept.
    if (sameRules(permissions, rolePermissions(role))) setPermissions(rolePermissions(nextRole));
    setRole(nextRole);
  };

  const handleSave = async () => {
    if (!cashier) return;
    const name = fullName.trim();
    if (!name) {
      toast({ title: "Enter a name for this portal", variant: "destructive" });
      return;
    }
    const nextPassword = password.trim();
    if (nextPassword && nextPassword.length < 6) {
      toast({ title: "The portal password needs at least 6 characters", variant: "destructive" });
      return;
    }
    const rules = cleanPermissions(permissions);
    if (Object.keys(rules).length === 0) {
      toast({ title: "Give this portal at least one screen", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (role !== cashier.role) await api.shop.setCashierRole(cashier.id, role);
      if (name !== cashier.full_name) await api.shop.renameCashier(cashier.id, name);
      if (!sameRules(rules, cashier.permissions || {})) {
        await api.shop.setCashierPermissions(cashier.id, rules);
      }
      if (nextPassword) await api.shop.setCashierPassword(cashier.id, nextPassword);
      toast({
        title: `${roleLabel(role)} updated`,
        description: nextPassword
          ? `${name}'s access and portal password were changed.`
          : `${name}'s access was updated.`,
      });
      setPassword("");
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Could not update this portal", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePassword = async () => {
    if (!cashier) return;
    setRemoving(true);
    try {
      await api.shop.clearCashierPassword(cashier.id);
      toast({
        title: "Password removed",
        description: `${cashier.full_name} can't open this portal until you set a new one.`,
      });
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Could not remove the password", description: err.message, variant: "destructive" });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {roleLabel(cashier?.role)} portal {cashier?.slot ?? ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="cashier-name">Name</Label>
            <Input
              id="cashier-name"
              className="mt-1"
              autoComplete="off"
              placeholder="e.g. Thandi"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              This is the name the person picks on the portal screen.
            </p>
          </div>

          <div>
            <Label>Role</Label>
            <MobileSelect
              value={role}
              onValueChange={changeRole}
              placeholder="Choose a role"
              options={STAFF_ROLES.map((option) => ({ value: option.key, label: option.label }))}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {STAFF_ROLES.find((option) => option.key === role)?.blurb}
            </p>
          </div>

          <PermissionEditor permissions={permissions} onChange={setPermissions} />

          <div className="rounded-lg border border-border p-3">
            <Label htmlFor="cashier-password" className="flex items-center gap-1.5">
              <KeyRound size={14} className="text-muted-foreground" aria-hidden="true" />
              Portal password
            </Label>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {cashier?.has_password
                ? "Set. This person types it to open the portal."
                : "Not set yet — this portal can't open until you set one."}
            </p>
            <Input
              id="cashier-password"
              className="mt-2"
              type="password"
              autoComplete="new-password"
              placeholder={cashier?.has_password ? "New password (leave blank to keep it)" : "At least 6 characters"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {cashier?.has_password && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemovePassword}
                disabled={removing || saving}
                className="mt-1 h-7 px-2 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                {removing ? <Loader2 size={12} className="mr-1 animate-spin" /> : null}
                Remove password
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || removing}
            className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Saving…" : "Save access"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { cleanPermissions } from "@/lib/modules";
import { STAFF_ROLES, rolePermissions } from "@/lib/portalAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MobileSelect } from "@/components/ui/mobile-select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus } from "lucide-react";
import PermissionEditor from "@/components/employees/PermissionEditor";

const sameRules = (a, b) =>
  JSON.stringify(cleanPermissions(a)) === JSON.stringify(cleanPermissions(b));

/**
 * Owner adds a cashier or supervisor portal. The plan decides how many of each a
 * store may run — the database refuses the one over the line, and its message is
 * what the owner sees.
 */
export default function AddCashierDialog({ shopId, role: initialRole = "cashier", open, onOpenChange, onSaved }) {
  const [role, setRole] = useState(initialRole);
  const [fullName, setFullName] = useState("");
  const [permissions, setPermissions] = useState(rolePermissions(initialRole));
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setRole(initialRole);
    setFullName("");
    setPermissions(rolePermissions(initialRole));
  }, [open, initialRole]);

  const changeRole = (nextRole) => {
    // Untouched rules follow the new role's preset; edited ones are kept.
    if (sameRules(permissions, rolePermissions(role))) setPermissions(rolePermissions(nextRole));
    setRole(nextRole);
  };

  const handleSave = async () => {
    const name = fullName.trim();
    if (!name) {
      toast({ title: "Enter a name for this portal", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const created = await api.shop.addCashier(shopId, role, name);
      if (created?.id && !sameRules(permissions, rolePermissions(role))) {
        await api.shop.setCashierPermissions(created.id, cleanPermissions(permissions));
      }
      toast({
        title: `${role === "supervisor" ? "Supervisor" : "Cashier"} added`,
        description: `${name} can open this portal once you set a password in Edit access.`,
      });
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Could not add this portal", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a staff portal</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
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

          <div>
            <Label htmlFor="new-portal-name">Name</Label>
            <Input
              id="new-portal-name"
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

          <PermissionEditor permissions={permissions} onChange={setPermissions} />
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {saving ? "Adding…" : "Add portal"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

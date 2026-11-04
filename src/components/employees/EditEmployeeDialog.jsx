import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { DEFAULT_ROLE, ROLE_PRESETS, cleanPermissions } from "@/lib/modules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MobileSelect } from "@/components/ui/mobile-select";
import { useToast } from "@/components/ui/use-toast";
import { KeyRound, Loader2, Save } from "lucide-react";
import PermissionEditor from "@/components/employees/PermissionEditor";

/**
 * Owner edits an existing employee's role, module access and their own cashier
 * portal password. The password is verified (and never stored in the browser)
 * by the database when the cashier opens their portal.
 */
export default function EditEmployeeDialog({ member, hasPassword = false, open, onOpenChange, onSaved }) {
  const [fullName, setFullName] = useState("");
  const [monthlySalary, setMonthlySalary] = useState("");
  const [role, setRole] = useState(DEFAULT_ROLE.role);
  const [permissions, setPermissions] = useState({});
  const [cashierPassword, setCashierPassword] = useState("");
  const [clearing, setClearing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!member) return;
    setFullName(member.full_name || "");
    setMonthlySalary(member.monthly_salary === null || member.monthly_salary === undefined ? "" : String(member.monthly_salary));
    setRole(member.role || DEFAULT_ROLE.role);
    setPermissions({ ...(member.permissions || {}) });
    setCashierPassword("");
  }, [member]);

  const roleOptions = [
    ...ROLE_PRESETS.map((preset) => preset.role),
    ...(member?.role && !ROLE_PRESETS.some((p) => p.role === member.role) ? [member.role] : []),
  ];

  const handleSave = async () => {
    if (!member) return;
    const name = fullName.trim();
    if (!name) {
      toast({ title: "Enter the employee's name", variant: "destructive" });
      return;
    }
    const salary = monthlySalary.trim() === "" ? null : Number(monthlySalary);
    if (salary !== null && (!Number.isFinite(salary) || salary < 0)) {
      toast({ title: "Enter the monthly salary in rand", variant: "destructive" });
      return;
    }
    const nextPassword = cashierPassword.trim();
    if (nextPassword && nextPassword.length < 6) {
      toast({ title: "The cashier password needs at least 6 characters", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.shop.updateMember(member.id, {
        full_name: name,
        monthly_salary: salary,
        role,
        permissions: cleanPermissions(permissions),
      });
      if (nextPassword) await api.shop.setCashierPassword(member.id, nextPassword);
      toast({
        title: "Access updated",
        description: nextPassword
          ? `${member.member_email}'s cashier password was changed.`
          : `${member.member_email} now has the access you set.`,
      });
      setCashierPassword("");
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Could not update access", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleClearPassword = async () => {
    if (!member) return;
    setClearing(true);
    try {
      await api.shop.clearCashierPassword(member.id);
      toast({
        title: "Cashier password removed",
        description: `${member.member_email} now opens the cashier portal with their own account.`,
      });
      onSaved?.();
    } catch (err) {
      toast({ title: "Could not remove the password", description: err.message, variant: "destructive" });
    } finally {
      setClearing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit access</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Employee</Label>
            <p className="mt-1 truncate text-sm font-medium text-foreground">{member?.member_email}</p>
          </div>

          <div>
            <Label>Employee name</Label>
            <Input
              className="mt-1"
              placeholder="e.g. Thandi Nkosi"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div>
            <Label>Monthly salary (R)</Label>
            <Input
              className="mt-1"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="e.g. 4500"
              value={monthlySalary}
              onChange={(e) => setMonthlySalary(e.target.value)}
            />
          </div>

          <div>
            <Label>Role</Label>
            <MobileSelect
              value={role}
              onValueChange={setRole}
              placeholder="Select role"
              triggerClassName="mt-1"
              options={roleOptions.map((value) => ({ value, label: value }))}
            />
          </div>

          <PermissionEditor permissions={permissions} onChange={setPermissions} />

          <div className="rounded-lg border border-border p-3">
            <Label className="flex items-center gap-1.5">
              <KeyRound size={14} className="text-muted-foreground" aria-hidden="true" />
              Cashier portal password
            </Label>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {hasPassword
                ? "Set. This cashier types it to open the cashier portal."
                : "Not set — this cashier opens the portal with their own account."}
            </p>
            <Input
              className="mt-2"
              type="password"
              autoComplete="new-password"
              placeholder={hasPassword ? "New password (leave blank to keep it)" : "At least 6 characters"}
              value={cashierPassword}
              onChange={(e) => setCashierPassword(e.target.value)}
            />
            {hasPassword && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearPassword}
                disabled={clearing || saving}
                className="mt-1 h-7 px-2 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                {clearing ? <Loader2 size={12} className="mr-1 animate-spin" /> : null}
                Remove password
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 gap-2 bg-green-600 hover:bg-green-700">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Saving…" : "Save access"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

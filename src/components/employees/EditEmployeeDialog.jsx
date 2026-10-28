import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { DEFAULT_ROLE, ROLE_PRESETS, cleanPermissions } from "@/lib/modules";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MobileSelect } from "@/components/ui/mobile-select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Save } from "lucide-react";
import PermissionEditor from "@/components/employees/PermissionEditor";

/** Owner edits an existing employee's role and module access. */
export default function EditEmployeeDialog({ member, open, onOpenChange, onSaved }) {
  const [role, setRole] = useState(DEFAULT_ROLE.role);
  const [permissions, setPermissions] = useState({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!member) return;
    setRole(member.role || DEFAULT_ROLE.role);
    setPermissions({ ...(member.permissions || {}) });
  }, [member]);

  const roleOptions = [
    ...ROLE_PRESETS.map((preset) => preset.role),
    ...(member?.role && !ROLE_PRESETS.some((p) => p.role === member.role) ? [member.role] : []),
  ];

  const handleSave = async () => {
    if (!member) return;
    setSaving(true);
    try {
      await api.shop.updateMember(member.id, {
        role,
        permissions: cleanPermissions(permissions),
      });
      toast({ title: "Access updated", description: `${member.member_email} now has the access you set.` });
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Could not update access", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
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

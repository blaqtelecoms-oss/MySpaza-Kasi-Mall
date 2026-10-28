import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { DEFAULT_ROLE, ROLE_PRESETS, cleanPermissions } from "@/lib/modules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MobileSelect } from "@/components/ui/mobile-select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Mail } from "lucide-react";
import PermissionEditor from "@/components/employees/PermissionEditor";

/**
 * Invite one employee: email, role and the modules they may use. The invite is
 * created and emailed by the app's server (Resend), never by the browser.
 */
export default function InviteEmployeeDialog({ open, onOpenChange, onSent }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(DEFAULT_ROLE.role);
  const [permissions, setPermissions] = useState({ ...DEFAULT_ROLE.permissions });
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) return;
    // Reset once the dialog has closed so the next invitation starts clean.
    setEmail("");
    setRole(DEFAULT_ROLE.role);
    setPermissions({ ...DEFAULT_ROLE.permissions });
    setSending(false);
  }, [open]);

  const applyRole = (value) => {
    setRole(value);
    const preset = ROLE_PRESETS.find((item) => item.role === value);
    if (preset) setPermissions({ ...preset.permissions });
  };

  const handleSend = async () => {
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      toast({ title: "Enter a valid email address", variant: "destructive" });
      return;
    }
    if (Object.keys(cleanPermissions(permissions)).length === 0) {
      toast({ title: "Choose at least one module", description: "The employee needs somewhere to work.", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      await api.shop.invite({ email: address, role, permissions: cleanPermissions(permissions) });
      toast({ title: "Invitation sent", description: `${address} will get an email with a link to join.` });
      onSent?.();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Could not send the invitation", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail size={18} /> Invite an employee
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Email address *</Label>
            <Input
              className="mt-1"
              type="email"
              inputMode="email"
              placeholder="employee@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              The invitation only works for this address, once, and expires in 7 days.
            </p>
          </div>

          <div>
            <Label>Role *</Label>
            <MobileSelect
              value={role}
              onValueChange={applyRole}
              placeholder="Select role"
              triggerClassName="mt-1"
              options={ROLE_PRESETS.map((preset) => ({ value: preset.role, label: preset.role }))}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Choosing a role fills in typical access — adjust it below if needed.
            </p>
          </div>

          <PermissionEditor permissions={permissions} onChange={setPermissions} />
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending}
            className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
            {sending ? "Sending…" : "Send invitation"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

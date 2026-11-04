import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { KeyRound, Loader2, Save } from "lucide-react";

/**
 * Owner edits one cashier: the name shown on the portal screen, and that
 * cashier's own portal password. The password only ever leaves the browser for
 * the database function that hashes it.
 */
export default function EditCashierDialog({ cashier, open, onOpenChange, onSaved }) {
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!cashier) return;
    setFullName(cashier.full_name || "");
    setPassword("");
  }, [cashier]);

  const handleSave = async () => {
    if (!cashier) return;
    const name = fullName.trim();
    if (!name) {
      toast({ title: "Enter the cashier's name", variant: "destructive" });
      return;
    }
    const nextPassword = password.trim();
    if (nextPassword && nextPassword.length < 6) {
      toast({ title: "The cashier password needs at least 6 characters", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (name !== cashier.full_name) await api.shop.renameCashier(cashier.id, name);
      if (nextPassword) await api.shop.setCashierPassword(cashier.id, nextPassword);
      toast({
        title: "Cashier updated",
        description: nextPassword
          ? `${name}'s portal password was changed.`
          : `${name} now shows on the portal screen with that name.`,
      });
      setPassword("");
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Could not update this cashier", description: err.message, variant: "destructive" });
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
        description: `${cashier.full_name} can't open the cashier portal until you set a new one.`,
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cashier {cashier?.slot ?? ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="cashier-name">Cashier name</Label>
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

          <div className="rounded-lg border border-border p-3">
            <Label htmlFor="cashier-password" className="flex items-center gap-1.5">
              <KeyRound size={14} className="text-muted-foreground" aria-hidden="true" />
              Cashier portal password
            </Label>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {cashier?.has_password
                ? "Set. This cashier types it to open the till."
                : "Not set yet — this cashier can't open the till until you set one."}
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
            {saving ? "Saving…" : "Save cashier"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

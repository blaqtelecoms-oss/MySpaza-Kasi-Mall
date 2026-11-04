import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Lock, ShieldCheck } from "lucide-react";

/**
 * The password that opens the owner portal for this store. It is separate from
 * the account's sign-in password, so the owner can hand a till to staff and
 * still keep the shop's own screens behind a password only they type.
 */
export default function OwnerPortalPasswordCard({ shopId, hasPassword, onSaved }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setPassword("");
    setConfirm("");
  }, [shopId]);

  const handleSave = async () => {
    const next = password.trim();
    if (next.length < 6) {
      toast({ title: "Use at least 6 characters", variant: "destructive" });
      return;
    }
    if (next !== confirm) {
      toast({ title: "The two passwords do not match", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.shop.setOwnerPortalPassword(shopId, next);
      toast({
        title: hasPassword ? "Owner portal password changed" : "Owner portal password set",
        description: "You type it on the portal screen after signing in.",
      });
      setPassword("");
      setConfirm("");
      onSaved?.();
    } catch (err) {
      toast({ title: "Could not save the password", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0D0D0D] text-[#FFD426]">
            <Lock size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground">Owner portal password</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {hasPassword
                ? "Set. Type it on the portal screen to open the owner portal."
                : "Not set yet — the owner portal cannot open until you choose one."}
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label htmlFor="owner-portal-password">
              {hasPassword ? "New owner portal password" : "Owner portal password"}
            </Label>
            <Input
              id="owner-portal-password"
              className="mt-1"
              type="password"
              autoComplete="new-password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="owner-portal-password-confirm">Repeat it</Label>
            <Input
              id="owner-portal-password-confirm"
              className="mt-1"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat the password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-2 bg-green-600 hover:bg-green-700"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
          {saving ? "Saving…" : hasPassword ? "Change password" : "Set password"}
        </Button>
      </CardContent>
    </Card>
  );
}

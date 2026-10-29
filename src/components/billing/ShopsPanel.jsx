import { useState } from "react";
import { Check, CircleNotch, Crown, MapPinPlus, PencilSimple, Plus, Storefront, X } from "@phosphor-icons/react";
import { api } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import { useSubscription } from "@/lib/SubscriptionContext";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import IconTile from "@/components/ui/icon-tile";
import { PLAN_BY_KEY, shopCountLabel } from "@/lib/plans";

/**
 * Shops & branches tab: the owner's shops, with the plan's allowance. The
 * database refuses a shop past the limit (`public.create_shop`), so the "at
 * your limit" state here is a mirror of the real rule.
 */
export default function ShopsPanel() {
  const { shop, refreshShop, switchShop } = useAuth();
  const { plan, planInfo, openCheckout } = useSubscription();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const shops = shop?.shops || [];
  const limit = shop?.shopLimit ?? null;
  const atLimit = limit !== null && shops.length >= limit;
  const nextPlanKey = plan === "free" ? "premium" : "ultra";
  const nextPlan = PLAN_BY_KEY[nextPlanKey];

  const handleAdd = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!name.trim()) {
      toast({ title: "Name required", description: "Give the new shop or branch a name.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const created = await api.shop.create({ name, address });
      setName("");
      setAddress("");
      await refreshShop();
      if (created?.id) await switchShop(created.id);
      toast({
        title: "Shop added",
        description: `${created?.name || "New branch"} is ready — you are working in it now.`,
      });
    } catch (error) {
      toast({ title: "Could not add the shop", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const startRename = (row) => {
    setRenamingId(row.id);
    setRenameValue(row.name || "");
  };

  const handleRename = async (shopId) => {
    if (!renameValue.trim()) return;
    try {
      await api.shop.rename(shopId, renameValue);
      setRenamingId(null);
      await refreshShop();
      toast({ title: "Shop renamed", description: "The receipt header follows the new name." });
    } catch (error) {
      toast({ title: "Could not rename", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconTile icon={Storefront} tone="teal" size="sm" /> Shops &amp; branches
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-600/30 bg-teal-50/60 p-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {shops.length} of {limit === null ? "unlimited" : limit} shop{limit === 1 ? "" : "s"} used
              </p>
              <p className="text-xs text-slate-600">
                {planInfo.name} plan · {shopCountLabel(plan).toLowerCase()}
              </p>
            </div>
            <Badge className="bg-teal-700 text-white hover:bg-teal-700">{planInfo.name}</Badge>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {shops.map((row) => {
              const isActive = row.id === shop?.shopId;
              return (
                <div
                  key={row.id}
                  className={`rounded-xl border p-3 ${isActive ? "border-teal-600 bg-teal-50/40" : "border-slate-200 bg-white"}`}
                >
                  <div className="flex items-start gap-2">
                    <IconTile icon={Storefront} tone={isActive ? "teal" : "slate"} size="sm" />
                    <div className="min-w-0 flex-1">
                      {renamingId === row.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={renameValue}
                            onChange={(event) => setRenameValue(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") handleRename(row.id);
                              if (event.key === "Escape") setRenamingId(null);
                            }}
                            className="h-7 text-xs"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleRename(row.id)}
                            className="rounded-md p-1 text-teal-700 hover:bg-teal-100"
                            aria-label="Save name"
                          >
                            <Check size={14} weight="bold" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenamingId(null)}
                            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                            aria-label="Cancel rename"
                          >
                            <X size={14} weight="bold" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <p className="min-w-0 truncate text-sm font-semibold text-slate-900">{row.name}</p>
                          <button
                            type="button"
                            onClick={() => startRename(row)}
                            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            aria-label={`Rename ${row.name}`}
                          >
                            <PencilSimple size={13} weight="regular" />
                          </button>
                        </div>
                      )}
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                        {row.address || "No address saved"}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {row.isPrimary && (
                          <Badge variant="secondary" className="text-[10px]">Main shop</Badge>
                        )}
                        {isActive ? (
                          <Badge className="bg-teal-700 text-[10px] text-white hover:bg-teal-700">Working here</Badge>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[11px]"
                            onClick={() => switchShop(row.id)}
                          >
                            Switch to
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {atLimit ? (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <IconTile icon={Crown} tone="amber" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {plan === "free" ? "Add a second branch on Premium" : "Run as many shops as you like on Ultra"}
                </p>
                <p className="text-xs text-slate-600">
                  {`${PLAN_BY_KEY[plan].name} covers ${shopCountLabel(plan)}. ${nextPlan.name} covers ${shopCountLabel(
                    nextPlanKey
                  ).toLowerCase()}${nextPlan.ads ? "" : " and removes ads"}.`}
                </p>
              </div>
            </div>
            <Button className="shrink-0" onClick={() => openCheckout(nextPlanKey)}>
              Upgrade to {nextPlan.name}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <IconTile icon={MapPinPlus} tone="teal" size="sm" /> Add a shop or branch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="branch-name" className="text-xs">Shop name</Label>
                  <Input
                    id="branch-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Main Street branch"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="branch-address" className="text-xs">Address (optional)</Label>
                  <Input
                    id="branch-address"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="e.g. 12 Main Rd, Newcastle"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-slate-500">
                  A branch keeps its own stock, sales and cash-ups. Your plan, team and receipt details carry over.
                </p>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <CircleNotch size={16} weight="bold" className="mr-2 animate-spin" />
                  ) : (
                    <Plus size={16} weight="bold" className="mr-2" />
                  )}
                  Add shop
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

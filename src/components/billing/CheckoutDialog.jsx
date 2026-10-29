import { useEffect, useState } from "react";
import { Check, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useSubscription } from "@/lib/SubscriptionContext";
import { PLAN_BY_KEY, planRank } from "@/lib/plans";

/**
 * Simulated checkout. Nothing is charged and no card details are entered — the
 * card row is a fixed test placeholder — so this stays clearly a demo of the
 * billing flow.
 */
export default function CheckoutDialog({ open, planKey, onOpenChange }) {
  const { plan, changePlan, isOwner, pendingPlanEffectiveAt, formatDate } = useSubscription();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);

  const target = PLAN_BY_KEY[planKey] || PLAN_BY_KEY.free;
  const downgrade = planRank(target.key) < planRank(plan);
  const current = PLAN_BY_KEY[plan] || PLAN_BY_KEY.free;

  useEffect(() => {
    if (!open) setProcessing(false);
  }, [open]);

  const handleConfirm = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      // Brief pause so the simulated transaction reads as a real one.
      await new Promise((resolve) => setTimeout(resolve, 900));
      await changePlan(target.key);
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Payment failed", description: error.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={processing ? undefined : onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{downgrade ? `Downgrade to ${target.name}` : `Upgrade to ${target.name}`}</DialogTitle>
          <DialogDescription>{target.blurb}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold text-slate-900">{target.name} plan</p>
              <p className="text-lg font-bold text-slate-900">
                {target.priceLabel}
                <span className="ml-1 text-xs font-medium text-slate-500">{target.cadence}</span>
              </p>
            </div>
            <ul className="mt-3 space-y-1.5">
              {(target.highlights || target.features.slice(0, 4)).map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-xs text-slate-600">
                  <Check className="h-3.5 w-3.5 shrink-0 text-teal-600" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {downgrade ? (
            <p className="text-xs text-slate-600">
              You keep {current.name} until {formatDate(pendingPlanEffectiveAt) || "the end of this billing period"}.
              From then on {target.name} features stay available and the rest are locked.
            </p>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <CreditCard className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">•••• •••• •••• 4242</p>
                <p className="text-[11px] text-slate-500">Test card · 12/34</p>
              </div>
            </div>
          )}

          <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
            Simulated payment — no real charge is made and no card details are collected.
          </p>

          {!isOwner && (
            <p className="text-xs text-amber-700">
              Only the shop owner can change the subscription.
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={processing}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-teal-700 hover:bg-teal-800"
              onClick={handleConfirm}
              disabled={processing || !isOwner}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing…
                </>
              ) : downgrade ? (
                "Schedule downgrade"
              ) : (
                `Pay ${target.priceLabel}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { Check, CircleNotch, CreditCard, ShieldCheck } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useSubscription } from "@/lib/SubscriptionContext";
import { GRACE_DAYS, PERIOD_DAYS, PLAN_BY_KEY } from "@/lib/plans";

/**
 * Plan checkout. A paid plan is bought on Yoco's hosted payment page: this
 * dialog only asks the API service for the payment page, and the plan switches
 * on once Yoco's signed webhook confirms the payment. Moving to Free needs no
 * payment — it is scheduled for the end of the paid period.
 */
export default function CheckoutDialog({ open, planKey, onOpenChange }) {
  const { plan, changePlan, isOwner, pendingPlanEffectiveAt, formatDate, startCheckout } = useSubscription();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const target = PLAN_BY_KEY[planKey] || PLAN_BY_KEY.free;
  const current = PLAN_BY_KEY[plan] || PLAN_BY_KEY.free;
  const paid = target.key !== "free";
  const downgrade = !paid && current.key !== "free";

  useEffect(() => {
    if (!open) {
      setProcessing(false);
      setRedirecting(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      if (!paid) {
        await changePlan(target.key);
        onOpenChange(false);
        return;
      }
      await startCheckout(target.key);
      // The browser is on its way to Yoco; keep the dialog in its waiting state.
      setRedirecting(true);
    } catch (error) {
      toast({ title: "Could not start the payment", description: error.message, variant: "destructive" });
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={processing ? undefined : onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {downgrade ? `Downgrade to ${target.name}` : paid ? `Subscribe to ${target.name}` : target.name}
          </DialogTitle>
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
                  <Check size={13} weight="bold" className="shrink-0 text-teal-600" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {downgrade ? (
            <p className="text-xs text-slate-600">
              You keep {current.name} until {formatDate(pendingPlanEffectiveAt) || "the end of this billing period"}.
              From then on the Free plan applies and paid features are locked.
            </p>
          ) : paid ? (
            <>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <CreditCard size={18} weight="duotone" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">Yoco secure checkout</p>
                  <p className="text-[11px] text-slate-500">
                    Card or instant EFT on Yoco's payment page. We never see your card details.
                  </p>
                </div>
              </div>
              <p className="rounded-lg bg-teal-50 p-3 text-[11px] leading-relaxed text-teal-900">
                {target.priceLabel} buys {PERIOD_DAYS} days of {target.name} from the moment Yoco confirms
                your payment. If the next payment is not settled, you keep everything for another{" "}
                {GRACE_DAYS} days before the shop drops back to Free.
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-600">
              The Free plan has no monthly fee. Paid features are locked until you upgrade.
            </p>
          )}

          <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck size={14} weight="duotone" className="text-teal-600" />
            {paid
              ? "Your plan activates only after Yoco confirms the payment."
              : "No payment is taken when you move to Free."}
          </p>

          {!isOwner && (
            <p className="text-xs text-amber-700">Only the shop owner can change the subscription.</p>
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
                  <CircleNotch size={16} weight="bold" className="mr-2 animate-spin" />
                  {redirecting ? "Opening Yoco…" : "Starting…"}
                </>
              ) : downgrade ? (
                "Schedule downgrade"
              ) : paid ? (
                `Pay ${target.priceLabel} with Yoco`
              ) : (
                "Stay on Free"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

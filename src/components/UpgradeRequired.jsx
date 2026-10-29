import { ArrowRight, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/lib/SubscriptionContext";
import { PLAN_BY_KEY, featureLabel } from "@/lib/plans";

/**
 * Paywall shown in place of a page the shop's plan does not include. The page
 * stays in the menu (nothing is hidden); opening it explains the upgrade.
 */
export default function UpgradeRequired({ feature }) {
  const { plan, requiredPlan, openCheckout, isOwner } = useSubscription();
  const navigate = useNavigate();

  const needed = PLAN_BY_KEY[requiredPlan(feature)] || PLAN_BY_KEY.premium;
  const current = PLAN_BY_KEY[plan] || PLAN_BY_KEY.free;
  const label = featureLabel(feature) || "This feature";

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <Lock className="h-5 w-5" />
        </span>

        <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-amber-600">
          Upgrade required
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">
          {label} is part of {needed.name}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Your shop is on the {current.name} plan. Upgrade to {needed.name} for{" "}
          {needed.priceLabel} {needed.cadence} to unlock {label.toLowerCase()} — everything you
          already use stays exactly as it is.
        </p>

        {isOwner ? (
          <div className="mt-5 space-y-2">
            <Button className="w-full bg-teal-700 hover:bg-teal-800" onClick={() => openCheckout(needed.key)}>
              Upgrade Now
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate("/settings?tab=billing")}>
              Compare plans
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="mt-5 space-y-2">
            <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              Ask the shop owner to upgrade to {needed.name} — the plan covers everyone working in
              this shop.
            </p>
            <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
              Back to dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

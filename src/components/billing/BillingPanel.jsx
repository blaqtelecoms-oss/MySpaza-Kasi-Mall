import { CalendarClock, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PlanCard from "@/components/billing/PlanCard";
import { useSubscription } from "@/lib/SubscriptionContext";
import { PLANS, PLAN_BY_KEY } from "@/lib/plans";

/** Billing & Subscription tab: the shop's plan plus the three plan cards. */
export default function BillingPanel() {
  const {
    plan,
    pendingPlan,
    pendingPlanEffectiveAt,
    currentPeriodEnd,
    openCheckout,
    formatDate,
    isOwner,
  } = useSubscription();

  const current = PLAN_BY_KEY[plan] || PLAN_BY_KEY.free;
  const scheduled = pendingPlan ? PLAN_BY_KEY[pendingPlan] : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Crown size={18} /> Current Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-teal-600/30 bg-teal-50/60 p-4">
            <div>
              <p className="text-lg font-bold text-slate-900">{current.name}</p>
              <p className="text-xs text-slate-600">{current.blurb}</p>
            </div>
            <p className="text-xl font-bold text-slate-900">
              {current.priceLabel}
              <span className="ml-1 text-xs font-medium text-slate-500">{current.cadence}</span>
            </p>
          </div>

          {currentPeriodEnd && plan !== "free" && (
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <CalendarClock className="h-3.5 w-3.5" />
              Current period ends {formatDate(currentPeriodEnd)}
            </p>
          )}

          {scheduled && (
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              Downgrade to <strong>{scheduled.name}</strong> is scheduled for{" "}
              {formatDate(pendingPlanEffectiveAt)}. You keep {current.name} until then.
            </p>
          )}

          {!isOwner && (
            <p className="text-xs text-slate-500">
              The plan belongs to this shop. Ask the owner to change it.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        {PLANS.map((planOption) => (
          <PlanCard
            key={planOption.key}
            plan={planOption}
            currentPlan={plan}
            onChoose={openCheckout}
          />
        ))}
      </div>

      <p className="text-[11px] text-slate-500">
        Plan changes are simulated for now: no card is charged and no payment details are stored.
      </p>
    </div>
  );
}

import { Check, Crown, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { planRank } from "@/lib/plans";

const ICONS = { free: Check, premium: Sparkles, ultra: Crown };

/** One plan card in the Billing section of Settings. */
export default function PlanCard({ plan, currentPlan, onChoose }) {
  const isCurrent = plan.key === currentPlan;
  const isDowngrade = planRank(plan.key) < planRank(currentPlan);
  const Icon = ICONS[plan.key] || Check;

  return (
    <div
      className={`flex h-full flex-col rounded-2xl border p-4 ${
        isCurrent ? "border-teal-600 bg-teal-50/60 shadow-sm" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <Icon className="h-4 w-4" />
          </span>
          <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
        </div>
        {isCurrent && <Badge className="bg-teal-700 text-white hover:bg-teal-700">Current</Badge>}
      </div>

      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
        {plan.priceLabel}
        <span className="ml-1 text-xs font-medium text-slate-500">{plan.cadence}</span>
      </p>
      <p className="mt-1 text-xs text-slate-500">{plan.blurb}</p>

      <ul className="mt-3 flex-1 space-y-1.5">
        {(plan.highlights || plan.features).map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-xs text-slate-600">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" />
            {feature}
          </li>
        ))}
      </ul>

      <Button
        className="mt-4 w-full"
        variant={isCurrent ? "outline" : "default"}
        disabled={isCurrent}
        onClick={() => onChoose(plan.key)}
      >
        {isCurrent ? "Current plan" : isDowngrade ? `Downgrade to ${plan.name}` : `Upgrade to ${plan.name}`}
      </Button>
    </div>
  );
}

import { Check, Confetti, Crown, Sparkle, Storefront } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/plans";

const ICONS = { free: Storefront, premium: Sparkle, ultra: Crown };

/**
 * Onboarding step 2: the plan step, which every new account must go through.
 * Free finishes the flow here; Premium and Ultra hand over to the app's existing
 * Yoco checkout (the plan switches on once the payment is confirmed).
 */
export default function PlanStep({ value, onChange, onContinue, saving, confirmingPayment }) {
  const paid = value && value !== "free";

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {PLANS.map((plan) => {
          const Icon = ICONS[plan.key] || Storefront;
          const selected = value === plan.key;
          return (
            <button
              key={plan.key}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(plan.key)}
              className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                selected
                  ? "border-teal-600 bg-teal-50/70 ring-1 ring-teal-600"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Icon size={20} weight="duotone" className="text-teal-700" />
                  <span className="text-sm font-semibold text-slate-900">{plan.name}</span>
                </div>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    selected ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300"
                  }`}
                  aria-hidden="true"
                >
                  {selected && <Check size={12} weight="bold" />}
                </span>
              </div>

              <p className="mt-2 text-xl font-bold tracking-tight text-slate-900">
                {plan.priceLabel}
                <span className="ml-1 text-xs font-medium text-slate-500">{plan.cadence}</span>
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{plan.blurb}</p>

              <ul className="mt-2 space-y-1">
                {plan.highlights.map((item) => (
                  <li key={item} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                    <Check size={11} weight="bold" className="mt-0.5 shrink-0 text-teal-600" />
                    {item}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {confirmingPayment && (
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          Yoco is confirming your payment. Your plan switches on by itself — this takes a few seconds.
        </p>
      )}

      <Button className="h-12 w-full text-sm font-semibold" onClick={onContinue} disabled={!value || saving}>
        {saving ? (
          "Finishing…"
        ) : paid ? (
          <>
            <Confetti size={18} weight="duotone" className="mr-2" />
            Continue to payment
          </>
        ) : (
          "Start using My Spaza"
        )}
      </Button>

      <p className="text-center text-[11px] text-muted-foreground">
        {paid
          ? "Yoco handles the card payment. Your plan switches on once it is confirmed."
          : "You can upgrade at any time from Settings → Billing."}
      </p>
    </div>
  );
}

import { useEffect, useState } from "react";
import {
  CalendarDots,
  CheckCircle,
  CircleNotch,
  ClockCountdown,
  Crown,
  Megaphone,
  SpeakerSimpleSlash,
  Storefront,
  WarningCircle,
} from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import IconTile from "@/components/ui/icon-tile";
import PlanCard from "@/components/billing/PlanCard";
import { useAuth } from "@/lib/AuthContext";
import { useSubscription } from "@/lib/SubscriptionContext";
import { api } from "@/api/client";
import { PLANS, PLAN_BY_KEY, daysLeft } from "@/lib/plans";

const money = (cents) =>
  "R " + (Number(cents || 0) / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Billing & Subscription tab: the shop's plan, its payment state and the plans. */
export default function BillingPanel() {
  const {
    plan,
    pendingPlan,
    pendingPlanEffectiveAt,
    currentPeriodEnd,
    graceEndsAt,
    paymentStatus,
    confirmingPayment,
    openCheckout,
    formatDate,
    isOwner,
  } = useSubscription();

  const current = PLAN_BY_KEY[plan] || PLAN_BY_KEY.free;
  const scheduled = pendingPlan ? PLAN_BY_KEY[pendingPlan] : null;
  const { shop } = useAuth();
  const shopsUsed = shop?.shops?.length ?? 1;
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    api.billing
      .payments(4)
      .then((rows) => !cancelled && setPayments(rows))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOwner, plan, paymentStatus, currentPeriodEnd]);

  const pendingPayment = payments.find((payment) => payment.status === "pending");
  const periodDaysLeft = daysLeft(currentPeriodEnd);
  const graceDaysLeft = daysLeft(graceEndsAt);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconTile icon={Crown} tone="amber" size="sm" /> Current Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-teal-600/30 bg-teal-50/60 p-4">
            <div className="min-w-0">
              <p className="text-lg font-bold text-slate-900">{current.name}</p>
              <p className="text-xs text-slate-600">{current.blurb}</p>
            </div>
            <p className="text-xl font-bold text-slate-900">
              {current.priceLabel}
              <span className="ml-1 text-xs font-medium text-slate-500">{current.cadence}</span>
            </p>
          </div>

          <PaymentState
            paymentStatus={paymentStatus}
            confirming={confirmingPayment}
            currentPeriodEnd={currentPeriodEnd}
            graceEndsAt={graceEndsAt}
            periodDaysLeft={periodDaysLeft}
            graceDaysLeft={graceDaysLeft}
            pendingPayment={pendingPayment}
            formatDate={formatDate}
            onRenew={isOwner ? () => openCheckout(plan === "free" ? "premium" : plan) : null}
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5">
              <IconTile icon={Storefront} tone="teal" size="sm" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900">
                  {shopsUsed} of {shop?.shopLimit ?? "unlimited"} shop{shop?.shopLimit === 1 ? "" : "s"}
                </p>
                <p className="text-[11px] text-slate-500">Shops &amp; branches in use</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5">
              <IconTile icon={current.ads ? Megaphone : SpeakerSimpleSlash} tone={current.ads ? "slate" : "teal"} size="sm" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900">{current.ads ? "Ads included" : "No ads"}</p>
                <p className="text-[11px] text-slate-500">
                  {current.ads ? "Sponsored banners on some screens" : "A clean, ad-free app"}
                </p>
              </div>
            </div>
          </div>

          {scheduled && (
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              Your plan moves to <strong>{scheduled.name}</strong> on {formatDate(pendingPlanEffectiveAt)}.
              You keep {current.name} until then.
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

      {isOwner && payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <IconTile icon={CalendarDots} tone="slate" size="sm" /> Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900">
                    {PLAN_BY_KEY[payment.plan]?.name || payment.plan} · {money(payment.amount_cents)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {formatDate(payment.paid_at || payment.created_date)}
                    {payment.status === "failed" && payment.failure_reason ? ` · ${payment.failure_reason}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    payment.status === "paid"
                      ? "bg-teal-100 text-teal-800"
                      : payment.status === "failed"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {payment.status}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-[11px] text-slate-500">
        Payments are handled by Yoco. A plan lasts 30 days from the confirmed payment, with a 7-day
        grace period before the shop returns to Free.
      </p>
    </div>
  );
}

/** The payment state banner: active, renewal due, grace, expired or pending. */
function PaymentState({
  paymentStatus,
  confirming,
  currentPeriodEnd,
  graceEndsAt,
  periodDaysLeft,
  graceDaysLeft,
  pendingPayment,
  formatDate,
  onRenew,
}) {
  if (confirming || pendingPayment) {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
        <CircleNotch size={15} className="mt-0.5 shrink-0 animate-spin text-teal-700" />
        <span>
          Payment pending. Yoco has not confirmed it yet — your plan updates automatically once it
          does, and nothing is charged twice.
        </span>
      </p>
    );
  }

  if (paymentStatus === "grace") {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
        <span className="flex items-start gap-2">
          <ClockCountdown size={15} className="mt-0.5 shrink-0" />
          <span>
            Payment overdue. Your {graceDaysLeft === 1 ? "last day" : `${graceDaysLeft} days`} of access
            ends {formatDate(graceEndsAt)} — after that the shop returns to Free.
          </span>
        </span>
        {onRenew && (
          <button type="button" onClick={onRenew} className="shrink-0 font-semibold underline">
            Renew
          </button>
        )}
      </div>
    );
  }

  if (paymentStatus === "expired") {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-900">
        <span className="flex items-start gap-2">
          <WarningCircle size={15} className="mt-0.5 shrink-0" />
          <span>Your paid period ended and paid features are locked. Renew to unlock them again.</span>
        </span>
        {onRenew && (
          <button type="button" onClick={onRenew} className="shrink-0 font-semibold underline">
            Renew
          </button>
        )}
      </div>
    );
  }

  if (paymentStatus === "active" && currentPeriodEnd) {
    const dueSoon = periodDaysLeft <= 7;
    return (
      <div
        className={`flex items-start justify-between gap-3 rounded-lg p-3 text-xs ${
          dueSoon ? "bg-amber-50 text-amber-900" : "bg-teal-50 text-teal-900"
        }`}
      >
        <span className="flex items-start gap-2">
          {dueSoon ? (
            <ClockCountdown size={15} className="mt-0.5 shrink-0" />
          ) : (
            <CheckCircle size={15} className="mt-0.5 shrink-0" />
          )}
          <span>
            {dueSoon ? "Renewal due" : "Active"} — {periodDaysLeft} day{periodDaysLeft === 1 ? "" : "s"} left,
            until {formatDate(currentPeriodEnd)}.
            {dueSoon ? " Pay now to keep everything without a gap." : ""}
          </span>
        </span>
        {dueSoon && onRenew && (
          <button type="button" onClick={onRenew} className="shrink-0 font-semibold underline">
            Renew
          </button>
        )}
      </div>
    );
  }

  return (
    <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
      You are on the Free plan. Premium and Ultra are paid monthly through Yoco, 30 days at a time.
    </p>
  );
}

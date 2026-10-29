import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { PLAN_BY_KEY, featurePlan, planIncludes, planRank, planStatus } from "@/lib/plans";
import CheckoutDialog from "@/components/billing/CheckoutDialog";

const SubscriptionContext = createContext(null);

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })
    : null;

/** How often the return page re-reads the payment while Yoco confirms it. */
const CONFIRM_ATTEMPTS = 8;
const CONFIRM_INTERVAL_MS = 2500;

/**
 * The shop's plan, shared by the owner and the employees working in that shop.
 * `checkoutPlan` opens the Yoco checkout modal; paid plans only switch on once
 * the API service has recorded a confirmed payment.
 */
export function SubscriptionProvider({ children }) {
  const { shop, refreshShop } = useAuth();
  const { toast } = useToast();
  const [checkoutPlanKey, setCheckoutPlanKey] = useState(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const confirmedRef = useRef(false);

  const plan = shop?.plan || "free";
  const paymentStatus = shop?.paymentStatus || planStatus(shop);

  const canUse = useCallback((feature) => planIncludes(plan, feature), [plan]);

  const requiredPlan = useCallback((feature) => featurePlan(feature), []);

  const openCheckout = useCallback((planKey) => {
    if (PLAN_BY_KEY[planKey]) setCheckoutPlanKey(planKey);
  }, []);

  const closeCheckout = useCallback(() => setCheckoutPlanKey(null), []);

  /** Sends the owner to Yoco's hosted payment page (the server creates it). */
  const startCheckout = useCallback(async (planKey) => {
    const result = await api.billing.startCheckout(planKey);
    if (result?.redirect_url) window.location.assign(result.redirect_url);
    return result;
  }, []);

  /** Scheduling a downgrade to Free is the only plan change the browser makes. */
  const changePlan = useCallback(
    async (planKey) => {
      const target = PLAN_BY_KEY[planKey];
      const result = await api.shop.setPlan(planKey);
      await refreshShop();

      toast({
        title: `Downgrade to ${target.name} scheduled`,
        description: `You keep ${PLAN_BY_KEY[plan].name} until ${formatDate(
          result?.pending_plan_effective_at
        )}.`,
      });
      return result;
    },
    [plan, refreshShop, toast]
  );

  // Returning from Yoco. The return URL proves nothing, so the payment row is
  // re-read until the signed webhook has settled it — and "not yet" is reported
  // as pending, never as paid.
  useEffect(() => {
    if (confirmedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const state = params.get("yoco");
    const paymentId = params.get("payment");
    if (!state) return;

    confirmedRef.current = true;

    const clearParams = () => {
      const next = new URLSearchParams(window.location.search);
      ["yoco", "payment"].forEach((key) => next.delete(key));
      if (!next.get("tab")) next.set("tab", "billing");
      window.history.replaceState({}, "", `${window.location.pathname}?${next.toString()}`);
    };

    if (state === "cancel") {
      toast({ title: "Payment cancelled", description: "Nothing was charged." });
      clearParams();
      return;
    }

    if (!paymentId) {
      toast({
        title: "Payment not confirmed yet",
        description: "Yoco has not confirmed this payment. Your plan stays as it is.",
        variant: "destructive",
      });
      clearParams();
      return;
    }

    let cancelled = false;
    setConfirmingPayment(true);

    (async () => {
      for (let attempt = 0; attempt < CONFIRM_ATTEMPTS; attempt += 1) {
        if (cancelled) return;
        let payment = null;
        try {
          payment = await api.billing.payment(paymentId);
        } catch {
          payment = null;
        }

        if (payment?.status === "paid") {
          await refreshShop();
          toast({
            title: `You're on ${PLAN_BY_KEY[payment.plan]?.name || "a paid plan"}`,
            description: "Your 30 days start from today. Thanks for supporting My Spaza!",
          });
          break;
        }
        if (payment?.status === "failed") {
          toast({
            title: "Payment did not go through",
            description: payment.failure_reason || "You can try again from Billing.",
            variant: "destructive",
          });
          break;
        }
        if (state === "failed" && attempt === CONFIRM_ATTEMPTS - 1) {
          toast({
            title: "Payment did not go through",
            description: "Nothing was charged. You can try again from Billing.",
            variant: "destructive",
          });
          break;
        }
        if (attempt < CONFIRM_ATTEMPTS - 1) {
          await new Promise((resolve) => setTimeout(resolve, CONFIRM_INTERVAL_MS));
        } else {
          toast({
            title: "Payment is still being confirmed",
            description: "Yoco has not confirmed it yet. Your plan updates automatically once it does.",
          });
        }
      }
      if (!cancelled) {
        setConfirmingPayment(false);
        clearParams();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshShop, toast]);

  const value = useMemo(
    () => ({
      plan,
      planInfo: PLAN_BY_KEY[plan] || PLAN_BY_KEY.free,
      storedPlan: shop?.storedPlan || plan,
      paymentStatus,
      pendingPlan: shop?.pendingPlan || null,
      pendingPlanEffectiveAt: shop?.pendingPlanEffectiveAt || null,
      periodStart: shop?.periodStart || null,
      currentPeriodEnd: shop?.currentPeriodEnd || null,
      graceEndsAt: shop?.graceEndsAt || null,
      lastPaymentAt: shop?.lastPaymentAt || null,
      isOwner: Boolean(shop?.isOwner),
      confirmingPayment,
      canUse,
      requiredPlan,
      openCheckout,
      closeCheckout,
      startCheckout,
      changePlan,
      formatDate,
    }),
    [
      plan,
      shop,
      paymentStatus,
      confirmingPayment,
      canUse,
      requiredPlan,
      openCheckout,
      closeCheckout,
      startCheckout,
      changePlan,
    ]
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
      <CheckoutDialog
        open={Boolean(checkoutPlanKey)}
        planKey={checkoutPlanKey}
        onOpenChange={(open) => !open && closeCheckout()}
      />
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) throw new Error("useSubscription must be used within a SubscriptionProvider");
  return context;
}

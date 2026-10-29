import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { api } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { PLAN_BY_KEY, featurePlan, planIncludes, planRank } from "@/lib/plans";
import CheckoutDialog from "@/components/billing/CheckoutDialog";

const SubscriptionContext = createContext(null);

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })
    : null;

/**
 * The shop's plan, shared by the owner and the employees working in that shop.
 * `checkoutPlan` drives the simulated checkout modal, which any paywall can
 * open with `openCheckout("premium")`.
 */
export function SubscriptionProvider({ children }) {
  const { shop, refreshShop } = useAuth();
  const { toast } = useToast();
  const [checkoutPlanKey, setCheckoutPlanKey] = useState(null);

  const plan = shop?.plan || "free";

  const canUse = useCallback((feature) => planIncludes(plan, feature), [plan]);

  const requiredPlan = useCallback((feature) => featurePlan(feature), []);

  const openCheckout = useCallback((planKey) => {
    if (PLAN_BY_KEY[planKey]) setCheckoutPlanKey(planKey);
  }, []);

  const closeCheckout = useCallback(() => setCheckoutPlanKey(null), []);

  const changePlan = useCallback(
    async (planKey) => {
      const target = PLAN_BY_KEY[planKey];
      const moving = planRank(planKey) > planRank(plan) ? "upgrade" : "downgrade";

      const result = await api.shop.setPlan(planKey);
      await refreshShop();

      if (moving === "downgrade") {
        toast({
          title: `Downgrade to ${target.name} scheduled`,
          description: `You keep ${PLAN_BY_KEY[plan].name} until ${formatDate(
            result?.pending_plan_effective_at
          )}.`,
        });
      } else {
        toast({
          title: `Successfully upgraded to ${target.name}!`,
          description: target.blurb,
        });
      }
      return result;
    },
    [plan, refreshShop, toast]
  );

  const value = useMemo(
    () => ({
      plan,
      planInfo: PLAN_BY_KEY[plan] || PLAN_BY_KEY.free,
      pendingPlan: shop?.pendingPlan || null,
      pendingPlanEffectiveAt: shop?.pendingPlanEffectiveAt || null,
      currentPeriodEnd: shop?.currentPeriodEnd || null,
      isOwner: Boolean(shop?.isOwner),
      canUse,
      requiredPlan,
      openCheckout,
      closeCheckout,
      changePlan,
      formatDate,
    }),
    [plan, shop, canUse, requiredPlan, openCheckout, closeCheckout, changePlan]
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

// Subscription plans and the features each one unlocks.
//
// `shop_plan_level()` in supabase/migrations/20261029_shop_subscriptions.sql
// enforces the same matrix in Postgres; the menu, the paywall and the plan
// cards only mirror it, so a crafted API call cannot reach a locked module.

export const PLAN_KEYS = ["free", "premium", "ultra"];

/** Feature keys are the app's module keys, so routes and plans line up. */
export const FEATURES = [
  { key: "pos", label: "Point of Sale", plan: "free" },
  { key: "inventory", label: "Inventory", plan: "free" },
  { key: "cashup", label: "Cash Up", plan: "free" },
  { key: "daily_sales", label: "Daily Sales", plan: "free" },
  { key: "expenses", label: "Expenses", plan: "free" },
  { key: "suppliers", label: "Suppliers", plan: "free" },
  { key: "academy", label: "Academy", plan: "free" },
  { key: "calculators", label: "Calculators", plan: "free" },
  { key: "funding", label: "Funding Hub", plan: "free" },
  { key: "myspaza_card", label: "MySpaza Card", plan: "free" },
  { key: "ads", label: "Ads", plan: "free" },
  { key: "employees", label: "Employees", plan: "premium" },
  { key: "reports", label: "Reports", plan: "premium" },
  { key: "coach", label: "Spaza Coach (AI Assistant)", plan: "premium" },
  { key: "customers", label: "Customers", plan: "premium" },
  { key: "debtors", label: "Debtors Control", plan: "ultra" },
  { key: "accounting", label: "Accounting", plan: "ultra" },
  { key: "banking", label: "Banking", plan: "ultra" },
];

const RANK = { free: 0, premium: 1, ultra: 2 };

export const PLANS = [
  {
    key: "free",
    name: "Free",
    price: 0,
    priceLabel: "R0",
    cadence: "forever",
    blurb: "Everything a spaza needs to run the day to day.",
    features: FEATURES.filter((f) => f.plan === "free").map((f) => f.label),
  },
  {
    key: "premium",
    name: "Premium",
    price: 199,
    priceLabel: "R199",
    cadence: "per month",
    blurb: "Add your team, your numbers and your AI coach.",
    features: FEATURES.filter((f) => RANK[f.plan] <= RANK.premium).map((f) => f.label),
    highlights: ["Employees and invitations", "Reports", "Spaza Coach AI", "Customers"],
  },
  {
    key: "ultra",
    name: "Ultra",
    price: 399,
    priceLabel: "R399",
    cadence: "per month",
    blurb: "The whole app, including debtors, accounting and banking.",
    features: FEATURES.map((f) => f.label),
    highlights: ["Everything in Premium", "Debtors Control", "Accounting", "Banking"],
  },
];

export const PLAN_BY_KEY = Object.fromEntries(PLANS.map((plan) => [plan.key, plan]));

const FEATURE_BY_KEY = Object.fromEntries(FEATURES.map((feature) => [feature.key, feature]));

export function planRank(planKey) {
  return RANK[planKey] ?? 0;
}

/** The lowest plan that includes a feature. */
export function featurePlan(featureKey) {
  return FEATURE_BY_KEY[featureKey]?.plan || "free";
}

export function featureLabel(featureKey) {
  return FEATURE_BY_KEY[featureKey]?.label || "";
}

/** Does this plan include the feature? */
export function planIncludes(planKey, featureKey) {
  return planRank(planKey) >= planRank(featurePlan(featureKey));
}

/**
 * The plan in force right now from a `shop_subscription` row: a scheduled
 * downgrade only takes over once its effective date has passed (the same rule
 * as `public.shop_effective_plan()`).
 */
export function resolvePlan(row) {
  if (!row) return "free";
  const due =
    row.pending_plan &&
    row.pending_plan_effective_at &&
    new Date(row.pending_plan_effective_at) <= new Date();
  return due ? row.pending_plan : row.plan || "free";
}

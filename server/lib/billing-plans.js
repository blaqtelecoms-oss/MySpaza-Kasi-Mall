// Paid subscription plans, priced on the server.
//
// A copy of the paid rows in src/lib/plans.js (the UI only mirrors them). The
// amount sent to Yoco — and checked again when a payment is settled — always
// comes from here, never from the browser, so a crafted request cannot buy
// Ultra for R1. Change both files together.
export const BILLING_PLANS = {
  premium: { name: "Premium", amountCents: 19900 },
  ultra: { name: "Ultra", amountCents: 39900 },
};

export const BILLING_CURRENCY = "ZAR";

/** 30 days of access from a confirmed payment, then a 7-day grace window. */
export const PERIOD_DAYS = 30;
export const GRACE_DAYS = 7;

export function billingPlan(key) {
  return Object.prototype.hasOwnProperty.call(BILLING_PLANS, key) ? BILLING_PLANS[key] : null;
}

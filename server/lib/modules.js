// The modules a shop owner can grant an employee, and the levels they can
// grant. Kept in sync with src/lib/modules.js — the server validates every
// invite with this list so a crafted request cannot store an unknown module.
export const EMPLOYEE_MODULES = [
  "pos",
  "inventory",
  "cashup",
  "daily_sales",
  "banking",
  "accounting",
  "expenses",
  "suppliers",
  "customers",
  "debtors",
  "reports",
  "academy",
  "calculators",
  "coach",
  "funding",
  "myspaza_card",
];

export const MODULE_LEVELS = ["view", "edit"];

/**
 * Keep only known modules with a known level: `{ pos: "edit", reports: "view" }`.
 * Anything else is dropped, and an empty result is rejected by the caller.
 */
export function sanitisePermissions(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const clean = {};
  for (const [key, value] of Object.entries(input)) {
    if (!EMPLOYEE_MODULES.includes(key)) continue;
    if (!MODULE_LEVELS.includes(value)) continue;
    clean[key] = value;
  }
  return clean;
}

export function sanitiseRole(input) {
  const role = String(input ?? "").trim().slice(0, 60);
  return role || "Employee";
}

export function isEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

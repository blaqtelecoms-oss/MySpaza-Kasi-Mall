// The app modules a shop owner can grant an employee, and the role presets the
// invite dialog starts from. `server/lib/modules.js` mirrors these keys — the
// server rejects an invitation that names anything else.

export const MODULE_LEVELS = ["view", "edit"];

export const MODULES = [
  { key: "pos", label: "Point of Sale", path: "/pos" },
  { key: "inventory", label: "Inventory", path: "/inventory" },
  { key: "cashup", label: "Cash Up", path: "/cashup" },
  { key: "daily_sales", label: "Daily Sales", path: "/daily-sales" },
  { key: "banking", label: "Banking", path: "/banking" },
  { key: "accounting", label: "Accounting", path: "/accounting" },
  { key: "expenses", label: "Expenses", path: "/expenses" },
  { key: "suppliers", label: "Suppliers", path: "/suppliers" },
  { key: "customers", label: "Customers", path: "/customers" },
  { key: "debtors", label: "Debtors Control", path: "/debtors" },
  { key: "reports", label: "Reports", path: "/reports" },
  { key: "academy", label: "Academy", path: "/academy" },
  { key: "calculators", label: "Calculators", path: "/calculators" },
  { key: "coach", label: "Spaza Coach", path: "/coach" },
  { key: "funding", label: "Funding Hub", path: "/funding" },
  { key: "myspaza_card", label: "MySpaza Card", path: "/myspaza-card" },
];

export const MODULE_LABELS = Object.fromEntries(MODULES.map((m) => [m.key, m.label]));

/** Roles offered in the invite dialog; each prefills a sensible module set. */
export const ROLE_PRESETS = [
  {
    role: "Cashier",
    permissions: { pos: "edit", inventory: "view", daily_sales: "view" },
  },
  {
    role: "Manager",
    permissions: {
      pos: "edit",
      inventory: "edit",
      cashup: "edit",
      daily_sales: "view",
      banking: "view",
      expenses: "edit",
      suppliers: "edit",
      customers: "edit",
      debtors: "edit",
      reports: "view",
      academy: "view",
      calculators: "view",
    },
  },
  {
    role: "Stock Controller",
    permissions: { inventory: "edit", suppliers: "view", reports: "view", calculators: "view" },
  },
  { role: "Viewer", permissions: { reports: "view", daily_sales: "view", inventory: "view" } },
];

export const DEFAULT_ROLE = ROLE_PRESETS[0];

/** Does this permission map grant at least `level` on `module`? */
export function moduleLevel(permissions, module) {
  const level = permissions?.[module];
  return level === "edit" ? 2 : level === "view" ? 1 : 0;
}

export function hasModule(permissions, module) {
  return moduleLevel(permissions, module) > 0;
}

export function canEdit(permissions, module) {
  return moduleLevel(permissions, module) === 2;
}

/** Cycle none → view → edit → none, for the compact permission chips. */
export function nextLevel(level) {
  if (level === "view") return "edit";
  if (level === "edit") return null;
  return "view";
}

/** Copy a permission map without the modules set to "none". */
export function cleanPermissions(permissions = {}) {
  return Object.fromEntries(
    Object.entries(permissions).filter(([, level]) => MODULE_LEVELS.includes(level))
  );
}

export function describePermissions(permissions) {
  const granted = Object.entries(permissions || {});
  if (granted.length === 0) return "No modules";
  return granted
    .map(([key, level]) => `${MODULE_LABELS[key] || key}: ${level === "edit" ? "edit" : "view"}`)
    .join(", ");
}

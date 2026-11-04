import { MODULES } from "@/lib/modules";

// What a cashier or supervisor portal may reach. Each portal carries its own
// access rules (a module map set by the owner on the Employees screen), so the
// till only shows the screens that portal was granted. These presets are what a
// new portal starts from — `cashier` rings up sales, `supervisor` also closes
// the till and reads the day's numbers.
export const CASHIER_DEFAULT_PERMISSIONS = {
  pos: "edit",
  inventory: "view",
  daily_sales: "view",
};

export const SUPERVISOR_DEFAULT_PERMISSIONS = {
  pos: "edit",
  inventory: "edit",
  cashup: "edit",
  daily_sales: "view",
  reports: "view",
};

export const STAFF_ROLES = [
  {
    key: "cashier",
    label: "Cashier",
    blurb: "Rings up sales and checks stock.",
    permissions: CASHIER_DEFAULT_PERMISSIONS,
  },
  {
    key: "supervisor",
    label: "Supervisor",
    blurb: "Runs the till, the cash up and the day's numbers.",
    permissions: SUPERVISOR_DEFAULT_PERMISSIONS,
  },
];

export const STAFF_ROLE_LABELS = Object.fromEntries(
  STAFF_ROLES.map((role) => [role.key, role.label])
);

export function roleLabel(role) {
  return STAFF_ROLE_LABELS[role] || STAFF_ROLE_LABELS.cashier;
}

/** The starting access rules for a role. */
export function rolePermissions(role) {
  return role === "supervisor"
    ? { ...SUPERVISOR_DEFAULT_PERMISSIONS }
    : { ...CASHIER_DEFAULT_PERMISSIONS };
}

/**
 * The access rules a portal session carries. A portal saved with no rules at
 * all falls back to its role's preset, so a session can never be left with no
 * screen at all.
 */
export function portalPermissions(portal) {
  const granted = portal?.permissions;
  if (granted && Object.keys(granted).length > 0) return granted;
  return rolePermissions(portal?.role);
}

/** The module a route belongs to, from src/lib/modules.js. */
export function moduleForPath(pathname) {
  const match = MODULES.find(
    (module) => pathname === module.path || pathname.startsWith(`${module.path}/`)
  );
  return match?.key || null;
}

/** May this portal session open this route? */
export function portalCanOpen(portal, pathname) {
  const module = moduleForPath(pathname);
  if (!module) return false;
  return Boolean(portalPermissions(portal)[module]);
}

/** Where a portal lands: Point of Sale when granted, otherwise its first screen. */
export function portalHomePath(portal) {
  const granted = portalPermissions(portal);
  if (granted.pos) return "/pos";
  const first = MODULES.find((module) => granted[module.key]);
  return first?.path || "/pos";
}

/** The routes a portal may open, for the sidebar. */
export function portalPaths(portal) {
  const granted = portalPermissions(portal);
  return MODULES.filter((module) => granted[module.key]).map((module) => module.path);
}

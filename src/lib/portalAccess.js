// What a cashier portal may reach. A cashier works a till — point of sale,
// stock on hand and the day's takings — while sales, cash-up, staff, settings
// and the money screens stay behind the owner portal's password.
export const CASHIER_PATHS = ["/pos", "/inventory", "/daily-sales"];

/** Is this route part of the cashier portal? */
export function canCashierOpen(pathname) {
  return CASHIER_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

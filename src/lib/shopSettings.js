// Shop profile + receipt options shared by the settings screen and the POS
// receipt. One `public.shop_settings` row per account holds it; these defaults
// cover a brand-new account (nothing saved yet).
export const SHOP_LOGO_BUCKET = "shop-logos";

export const DEFAULT_SHOP_SETTINGS = {
  business: {
    name: "My Spaza Shop",
    type: "",
    owner: "",
    phone: "",
    email: "",
    address: "",
    vatNumber: "",
    registrationNumber: "",
    currency: "ZAR",
  },
  receipt: {
    showLogo: true,
    showVAT: false,
    footer: "Thank you for shopping with us!",
    paperSize: "80mm",
  },
  logoUrl: "",
};

/** Merge a stored `shop_settings` row (or nothing) over the defaults. */
export function toShopSettings(row) {
  if (!row) return DEFAULT_SHOP_SETTINGS;
  return {
    business: { ...DEFAULT_SHOP_SETTINGS.business, ...(row.business || {}) },
    receipt: { ...DEFAULT_SHOP_SETTINGS.receipt, ...(row.receipt || {}) },
    logoUrl: row.logo_url || "",
  };
}

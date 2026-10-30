import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CaretDown, Check, Plus, Storefront } from "@phosphor-icons/react";
import { useAuth } from "@/lib/AuthContext";

/**
 * The owner's shops, in the sidebar. Switching narrows every screen to that
 * branch's records (the database allows all of them; the app scopes the view).
 */
export default function ShopSwitcher() {
  const { shop, switchShop } = useAuth();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!shop?.isOwner || !shop.shops?.length) return null;

  const active = shop.shops.find((row) => row.id === shop.shopId) || shop.shops[0];

  const handleSwitch = async (shopId) => {
    if (busyId) return;
    setBusyId(shopId);
    try {
      await switchShop(shopId);
      setOpen(false);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="relative px-3 pb-3" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Switch shop or branch"
        className="flex w-full items-center gap-2 rounded-xl bg-white/5 px-2.5 py-2 text-left ring-1 ring-white/10 transition hover:bg-white/10"
      >
        {shop.shopLogo ? (
          <img
            src={shop.shopLogo}
            alt={active?.name || "Shop logo"}
            className="h-7 w-7 shrink-0 rounded-lg object-cover ring-1 ring-white/15"
          />
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#FFD426] text-[#0D0D0D]">
            <Storefront size={15} weight="fill" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-white">{active?.name || "My shop"}</span>
          <span className="block text-[10px] text-white/45">
            {shop.shopLimit === null
              ? `${shop.shops.length} shops · unlimited`
              : `${shop.shops.length} of ${shop.shopLimit} shops`}
          </span>
        </span>
        <CaretDown size={14} weight="bold" className={`shrink-0 text-white/50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-3 right-3 z-50 mt-1 overflow-hidden rounded-xl border border-white/10 bg-[#171717] shadow-xl">
          <ul className="max-h-64 overflow-y-auto py-1">
            {shop.shops.map((row) => {
              const isActive = row.id === shop.shopId;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => handleSwitch(row.id)}
                    disabled={isActive || busyId === row.id}
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left text-xs transition ${
                      isActive ? "text-[#FFD426]" : "text-white/75 hover:bg-white/5"
                    }`}
                  >
                    <span className="mt-0.5 w-3.5 shrink-0">
                      {isActive ? <Check size={13} weight="bold" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{row.name}</span>
                      {row.address && <span className="block truncate text-[10px] text-white/40">{row.address}</span>}
                    </span>
                    {row.isPrimary && (
                      <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white/50">
                        Main
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <Link
            to="/settings?tab=shops"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5 text-xs font-medium text-[#FFD426] hover:bg-white/5"
          >
            <Plus size={13} />
            {shop.canAddShop ? "Add a shop or branch" : "Manage shops"}
          </Link>
        </div>
      )}
    </div>
  );
}

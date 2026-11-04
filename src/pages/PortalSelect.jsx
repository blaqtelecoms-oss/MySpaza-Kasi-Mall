import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Loader2, ShieldCheck, ShoppingBasket, Store } from "lucide-react";
import { api } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import { usePortal } from "@/lib/PortalContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MobileSelect } from "@/components/ui/mobile-select";
import PortalOptionCard from "@/components/portal/PortalOptionCard";

/**
 * The step between signing in and the shop: which store, and which portal.
 * The owner portal is the owner's own account; the cashier portal asks for the
 * individual password the owner set for that cashier, and the database checks
 * it before any of the shop's data opens.
 */
export default function PortalSelect() {
  const { shop, user, switchShop, logout } = useAuth();
  const { openOwnerPortal, openCashierPortal } = usePortal();
  const navigate = useNavigate();

  const [storeId, setStoreId] = useState(null);
  const [password, setPassword] = useState("");
  const [access, setAccess] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null); // "store" | "owner" | "cashier"

  const stores = useMemo(() => {
    if (!shop) return [];
    if (!shop.isOwner) return [{ id: shop.shopId, name: shop.shopName || "Your store" }];
    return shop.shops || [];
  }, [shop]);

  const activeStoreId = storeId || shop?.shopId || null;
  const activeStore = stores.find((store) => store.id === activeStoreId) || stores[0] || null;

  useEffect(() => {
    if (shop?.shopId) setStoreId(shop.shopId);
  }, [shop?.shopId]);

  // Does this store require a cashier password from me, and is one set?
  useEffect(() => {
    let active = true;
    setAccess(null);
    setPassword("");
    setError("");
    if (!shop || shop.isOwner || !activeStoreId) return undefined;
    api.shop
      .cashierAccess(activeStoreId)
      .then((data) => active && setAccess(data))
      .catch(() => active && setAccess(null));
    return () => {
      active = false;
    };
  }, [shop?.isOwner, activeStoreId]);

  const handleStore = async (id) => {
    if (!id || id === activeStoreId) return;
    setStoreId(id);
    setError("");
    setPassword("");
    if (!shop?.isOwner) return;
    setBusy("store");
    try {
      await switchShop(id);
    } catch (err) {
      setError(err.message || "Could not switch store.");
    } finally {
      setBusy(null);
    }
  };

  const enterOwner = async () => {
    setBusy("owner");
    setError("");
    try {
      await openOwnerPortal(activeStoreId);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Could not open the owner portal.");
    } finally {
      setBusy(null);
    }
  };

  const enterCashier = async (event) => {
    event.preventDefault();
    setBusy("cashier");
    setError("");
    try {
      const result = await openCashierPortal(activeStoreId, password);
      if (result?.ok) {
        navigate("/", { replace: true });
        return;
      }
      if (result?.reason === "locked") {
        setError("Too many wrong attempts. Try again in a few minutes.");
      } else if (result?.reason === "invalid") {
        const left = result?.attempts_left;
        setError(
          `That cashier password is not right.${typeof left === "number" && left > 0 ? ` ${left} ${left === 1 ? "try" : "tries"} left.` : ""}`
        );
      } else {
        setError("Could not open the cashier portal. Ask the store owner to check your access.");
      }
    } catch (err) {
      setError(err.message || "Could not open the cashier portal.");
    } finally {
      setBusy(null);
    }
  };

  if (!shop) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F6F8]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
      </div>
    );
  }

  const hasPassword = access?.has_password !== false;

  return (
    <div className="min-h-screen bg-[#F5F6F8] px-4 py-7 text-slate-900 sm:px-6">
      <div className="mx-auto w-full max-w-lg">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/brand/logo.png"
              alt=""
              className="h-9 w-9 rounded-lg object-cover ring-1 ring-slate-200"
            />
            <div>
              <p className="text-sm font-semibold tracking-tight">My Spaza</p>
              <p className="text-[11px] text-slate-500">Choose your portal</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => logout(true)}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 underline-offset-4 hover:bg-white hover:text-slate-900 hover:underline"
          >
            Sign out
          </button>
        </header>

        <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_44px_-26px_rgba(15,23,42,0.35)] sm:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Signed in as
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-slate-800">
            {user?.full_name || user?.email}
          </p>

          <div className="mt-5">
            <Label className="text-[13px] font-medium text-slate-700">Store</Label>
            {stores.length > 1 ? (
              <MobileSelect
                value={activeStoreId}
                onValueChange={handleStore}
                placeholder="Choose a store"
                triggerClassName="mt-1.5 h-11 border-slate-300 bg-white"
                options={stores.map((store) => ({
                  value: store.id,
                  label: store.isPrimary ? `${store.name} · main` : store.name,
                }))}
              />
            ) : (
              <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                <Store size={16} className="shrink-0 text-slate-500" aria-hidden="true" />
                <span className="truncate text-sm font-medium text-slate-800">
                  {activeStore?.name || shop.shopName || "Your store"}
                </span>
              </div>
            )}
            {busy === "store" && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Switching store…
              </p>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <div className="mt-5 space-y-3">
            <PortalOptionCard
              icon={Store}
              title="Owner portal"
              subtitle="Everything in the store: sales, stock, cash-up, staff and settings."
              action={
                shop.isOwner ? (
                  <Button
                    onClick={enterOwner}
                    disabled={busy !== null || !activeStoreId}
                    className="h-11 w-full gap-2 rounded-lg bg-[#0D0D0D] text-white shadow-none hover:bg-[#1d1d1d]"
                  >
                    {busy === "owner" ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : null}
                    Enter owner portal
                    {busy === "owner" ? null : <ArrowRight size={16} aria-hidden="true" />}
                  </Button>
                ) : (
                  <p className="rounded-lg bg-slate-100 px-3 py-2.5 text-xs leading-relaxed text-slate-500">
                    Only the store owner can open this portal. Ask the owner if you need owner
                    access.
                  </p>
                )
              }
            />

            <PortalOptionCard
              icon={ShoppingBasket}
              title="Cashier portal"
              subtitle="Ring up sales with only the access the owner gave you."
              tone="cashier"
              disabled={shop.isOwner}
              action={
                shop.isOwner ? (
                  <p className="rounded-lg bg-slate-100 px-3 py-2.5 text-xs leading-relaxed text-slate-500">
                    This portal is for your staff. Set each cashier's own password in Employees, on
                    the owner portal.
                  </p>
                ) : (
                  <form onSubmit={enterCashier} className="space-y-2.5">
                    {hasPassword && (
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="cashier-password"
                          className="text-[13px] font-medium text-slate-700"
                        >
                          Cashier password
                        </Label>
                        <Input
                          id="cashier-password"
                          type="password"
                          autoComplete="current-password"
                          placeholder="Your cashier password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          className="h-11 rounded-lg border-slate-300 bg-white"
                        />
                      </div>
                    )}
                    {access?.has_password === false && (
                      <p className="text-xs leading-relaxed text-slate-500">
                        The owner hasn't set a cashier password for you yet, so your account opens
                        it.
                      </p>
                    )}
                    <Button
                      type="submit"
                      disabled={busy !== null || access === null}
                      className="h-11 w-full gap-2 rounded-lg bg-teal-600 text-white shadow-none hover:bg-teal-700"
                    >
                      {busy === "cashier" ? (
                        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <ShieldCheck size={16} aria-hidden="true" />
                      )}
                      Open cashier portal
                    </Button>
                  </form>
                )
              }
              hint={
                shop.isOwner
                  ? undefined
                  : "Forgotten it? The store owner can set a new one for you."
              }
            />
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-500">
          Each cashier has their own password, set by the store owner.
        </p>
      </div>
    </div>
  );
}

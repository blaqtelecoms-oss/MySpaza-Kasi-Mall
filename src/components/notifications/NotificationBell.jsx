import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell, BellRinging, CheckCircle, Money, Package, Warning, Wallet, X,
} from "@phosphor-icons/react";
import { useEntityQuery } from "@/hooks/useEntityQuery";
import { useAuth } from "@/lib/AuthContext";
import IconTile from "@/components/ui/icon-tile";

const formatCurrency = (n) => `R ${(n || 0).toFixed(2)}`;
const today = new Date().toISOString().split("T")[0];

// Read and dismissed state lives on this device, keyed per account. The alerts
// themselves are derived from the shop's own records on every render, so a
// dismissed warning comes back if it is still true next time it is opened.
const storageKey = (userId) => `myspaza:notifications:${userId || "guest"}`;

function readState(userId) {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      read: Array.isArray(parsed?.read) ? parsed.read : [],
      dismissed: Array.isArray(parsed?.dismissed) ? parsed.dismissed : [],
    };
  } catch {
    return { read: [], dismissed: [] };
  }
}

function writeState(userId, state) {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    /* private mode: the panel still works for this visit */
  }
}

/**
 * The bell in the top bar. Everything listed comes from data the shop already
 * has (stock levels, today's cash up, customer credit), so there are no
 * invented notifications — an empty workspace shows the "all caught up" state.
 */
export default function NotificationBell() {
  const { user, can } = useAuth();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ read: [], dismissed: [] });
  const ref = useRef(null);

  const productsQuery = useEntityQuery("Product", "list", []);
  const cashupsQuery = useEntityQuery("CashUp", "filter", [{ cashup_date: today }]);
  const customersQuery = useEntityQuery("Customer", "list", []);

  useEffect(() => {
    setState(readState(user?.id));
  }, [user?.id]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const alerts = useMemo(() => {
    const products = productsQuery.data || [];
    const cashups = cashupsQuery.data || [];
    const customers = customersQuery.data || [];
    const list = [];

    const outOfStock = products.filter((p) => (p.stock_quantity || 0) <= 0);
    const lowStock = products.filter(
      (p) => (p.stock_quantity || 0) > 0 && p.stock_quantity <= (p.min_stock_level || 5)
    );
    const owing = customers.filter((c) => (c.outstanding_balance || 0) > 0);
    const owedTotal = owing.reduce((sum, c) => sum + c.outstanding_balance, 0);
    const cashup = cashups.find((c) => c.cashup_date === today) || cashups[0] || null;
    const difference = cashup?.cash_difference || 0;

    if (can("inventory") && outOfStock.length > 0) {
      list.push({
        id: "out-of-stock",
        tone: "red",
        icon: Package,
        title: `${outOfStock.length} product${outOfStock.length === 1 ? "" : "s"} out of stock`,
        description: outOfStock.slice(0, 3).map((p) => p.name).join(", "),
        to: "/inventory",
      });
    }
    if (can("inventory") && lowStock.length > 0) {
      list.push({
        id: "low-stock",
        tone: "amber",
        icon: Warning,
        title: `${lowStock.length} product${lowStock.length === 1 ? "" : "s"} running low`,
        description: lowStock.slice(0, 3).map((p) => `${p.name} (${p.stock_quantity})`).join(", "),
        to: "/inventory",
      });
    }
    if (can("cashup") && !cashup) {
      list.push({
        id: `cashup-open-${today}`,
        tone: "teal",
        icon: Money,
        title: "Cash up not done yet",
        description: "Count the till and reconcile today's cash before closing.",
        to: "/cashup",
      });
    } else if (can("cashup") && Math.abs(difference) > 10) {
      list.push({
        id: `cashup-difference-${cashup.id}`,
        tone: "red",
        icon: Money,
        title: `Till is ${difference < 0 ? "short" : "over"} ${formatCurrency(Math.abs(difference))}`,
        description: "Check today's cash up and note what happened.",
        to: "/cashup",
      });
    }
    if (can("customers") && owing.length > 0) {
      list.push({
        id: "customer-credit",
        tone: "amber",
        icon: Wallet,
        title: `${owing.length} customer${owing.length === 1 ? "" : "s"} owe you money`,
        description: `${formatCurrency(owedTotal)} outstanding in credit sales.`,
        to: "/debtors",
      });
    }
    return list.filter((alert) => !state.dismissed.includes(alert.id));
  }, [productsQuery.data, cashupsQuery.data, customersQuery.data, state.dismissed, can]);

  const unread = alerts.filter((alert) => !state.read.includes(alert.id));
  const unreadCount = unread.length;

  const persist = (next) => {
    setState(next);
    writeState(user?.id, next);
  };

  const markRead = (id) => {
    if (state.read.includes(id)) return;
    persist({ ...state, read: [...state.read, id] });
    setOpen(false);
  };

  const dismiss = (id) => {
    persist({
      read: [...new Set([...state.read, id])],
      dismissed: [...new Set([...state.dismissed, id])],
    });
  };

  const markAllRead = () => persist({ ...state, read: [...new Set([...state.read, ...alerts.map((a) => a.id)])] });

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        className="relative rounded-xl p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD426]"
      >
        {unreadCount > 0 ? (
          <BellRinging size={21} weight="fill" className="text-slate-900" />
        ) : (
          <Bell size={21} weight="regular" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[11px] font-medium text-slate-500 transition hover:text-slate-900"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <CheckCircle size={28} weight="duotone" className="mx-auto text-emerald-600" />
                <p className="mt-2 text-sm font-medium text-slate-800">You're all caught up</p>
                <p className="mt-1 text-xs text-slate-500">Stock, cash up and customer credit all look fine.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {alerts.map((alert) => {
                  const isUnread = !state.read.includes(alert.id);
                  return (
                    <li key={alert.id} className={`relative flex gap-3 px-4 py-3 ${isUnread ? "bg-slate-50/80" : ""}`}>
                      <IconTile icon={alert.icon} tone={alert.tone} size="sm" />
                      <Link
                        to={alert.to}
                        onClick={() => markRead(alert.id)}
                        className="min-w-0 flex-1 pr-5"
                      >
                        <p className={`text-sm leading-snug ${isUnread ? "font-semibold text-slate-900" : "font-medium text-slate-700"}`}>
                          {alert.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{alert.description}</p>
                      </Link>
                      <button
                        type="button"
                        onClick={() => dismiss(alert.id)}
                        aria-label={`Dismiss: ${alert.title}`}
                        className="absolute right-2 top-2 rounded-md p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                      >
                        <X size={12} weight="bold" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Link
            to="/settings?tab=notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-100 px-4 py-2.5 text-center text-[11px] font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            Notification settings
          </Link>
        </div>
      )}
    </div>
  );
}

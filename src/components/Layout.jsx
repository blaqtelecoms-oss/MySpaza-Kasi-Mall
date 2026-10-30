import { useEffect, useRef, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard, ShoppingCart, Package, TrendingUp, DollarSign,
  Users, Truck, BookOpen, BarChart2, Settings, Menu, X, Bell,
  Building2, GraduationCap, Bot, CreditCard, ChevronDown, ChevronRight,
  Banknote, UserCheck, Calculator, RefreshCw, Wallet, ArrowLeft, TrendingDown, Receipt,
  MailSearch, LogOut, PackagePlus
} from "lucide-react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useAuth } from "@/lib/AuthContext";
import { queryClientInstance } from "@/lib/query-client";
import OfflineBanner from "@/components/OfflineBanner";
import ShopSwitcher from "@/components/shop/ShopSwitcher";

// `module` is an employee permission key (see src/lib/modules.js): a shop owner
// sees everything, an employee only the modules the owner granted. `ownerOnly`
// screens manage the shop itself and are never shown to employees.
const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: ShoppingCart, label: "Point of Sale", path: "/pos", module: "pos" },
  { icon: Package, label: "Inventory", path: "/inventory", module: "inventory" },
  { icon: Banknote, label: "Cash Up", path: "/cashup", module: "cashup" },
  { icon: Receipt, label: "Daily Sales", path: "/daily-sales", module: "daily_sales" },
  { icon: Building2, label: "Banking", path: "/banking", module: "banking" },
  { icon: TrendingUp, label: "Accounting", path: "/accounting", module: "accounting" },
  { icon: DollarSign, label: "Expenses", path: "/expenses", module: "expenses" },
  { icon: Truck, label: "Suppliers", path: "/suppliers", module: "suppliers" },
  { icon: Users, label: "Customers", path: "/customers", module: "customers" },
  { icon: TrendingDown, label: "Debtors Control", path: "/debtors", module: "debtors" },
  { icon: UserCheck, label: "Employees", path: "/employees", ownerOnly: true },
  { icon: BarChart2, label: "Reports", path: "/reports", module: "reports" },
  { icon: GraduationCap, label: "Academy", path: "/academy", module: "academy" },
  { icon: Calculator, label: "Calculators", path: "/calculators", module: "calculators" },
  { icon: Bot, label: "Spaza Coach", path: "/coach", module: "coach" },
  { icon: CreditCard, label: "Funding Hub", path: "/funding", module: "funding" },
  { icon: Wallet, label: "MySpaza Card", path: "/myspaza-card", module: "myspaza_card" },
  { icon: Settings, label: "Settings", path: "/settings", ownerOnly: true },
  // Operator-only: the Resend delivery log for signup and account emails.
  { icon: MailSearch, label: "Email Log", path: "/admin/email-events", adminOnly: true },
  // Operator-only: copy every shop's catalogue into one account and hand out a plan.
  { icon: PackagePlus, label: "Catalogue Copy", path: "/admin/product-copy", adminOnly: true },
];

export default function Layout() {
  const { user, logout, shop, can } = useAuth();
  // Owners see every screen; an employee only the modules granted to them.
  const visibleNavItems = navItems.filter((item) => {
    if (item.adminOnly && user?.role !== "admin") return false;
    if (item.ownerOnly && !shop?.isOwner) return false;
    if (item.module && !can(item.module)) return false;
    return true;
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [btnRefreshing, setBtnRefreshing] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const profileRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  const userInitial = (user?.full_name || user?.email || "?").trim().charAt(0).toUpperCase();

  useEffect(() => {
    if (!profileOpen) return;
    const handleOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [profileOpen]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout(true);
    } finally {
      setSigningOut(false);
    }
  };

  const handleRefresh = async () => {
    if (btnRefreshing) return;
    setBtnRefreshing(true);
    try {
      await queryClientInstance.invalidateQueries();
    } finally {
      setTimeout(() => setBtnRefreshing(false), 700);
    }
  };
  const isSubPage = !["/", "/pos", "/inventory", "/myspaza-card"].includes(location.pathname);
  const { scrollRef, pullDistance, refreshing } = usePullToRefresh({
    onRefresh: async () => { await queryClientInstance.invalidateQueries(); },
  });

  const showPullIndicator = pullDistance > 0 || refreshing;
  const indicatorOpacity = refreshing ? 1 : Math.min(pullDistance / 70, 1);
  const indicatorRotation = refreshing ? "0deg" : `${pullDistance * 3}deg`;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-[#0D0D0D] to-[#171717] flex flex-col transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/brand/logo.png" alt="MySpaza" className="w-8 h-8 shrink-0 rounded-lg object-cover" />
            <h1 className="text-white font-bold text-lg leading-none tracking-tight truncate">
              MySpaza
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              title="Refresh data"
              className="p-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              <RefreshCw size={18} className={btnRefreshing ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Which shop the owner is working in (branches live under Settings → Shops) */}
        <ShopSwitcher />

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 select-none">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
              (item.path !== "/" && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 transition-all ${
                  isActive
                    ? "bg-[#FFD426] text-[#0D0D0D] font-semibold shadow-md"
                    : "text-white/70 hover:bg-white/10"
                }`}
              >
                <Icon size={18} strokeWidth={1.9} className="shrink-0" />
                <span className="text-sm truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-4 border-t border-white/10" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-white/70 text-xs font-medium">My Spaza</p>
            <p className="text-white/40 text-xs mt-0.5">Empowering SA Businesses</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header
          className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between shadow-sm select-none"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
        >
          <div className="flex items-center gap-3">
            {isSubPage && (
              <button
                onClick={() => navigate(-1)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ArrowLeft size={22} className="text-gray-600 dark:text-gray-300" />
              </button>
            )}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Menu size={22} className="text-gray-600 dark:text-gray-300" />
            </button>
            <div className="hidden sm:block">
              <h2 className="font-semibold text-gray-800 dark:text-gray-100">
                {visibleNavItems.find(i =>
                  i.path === location.pathname ||
                  (i.path !== "/" && location.pathname.startsWith(i.path))
                )?.label || "My Spaza"}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{new Date().toLocaleDateString("en-ZA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
              <Bell size={20} className="text-gray-600 dark:text-gray-300" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((open) => !open)}
                aria-label="Profile menu"
                aria-expanded={profileOpen}
                className="w-8 h-8 bg-[#0D0D0D] rounded-full flex items-center justify-center ring-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD426] hover:opacity-90 transition-opacity"
              >
                {shop?.shopLogo ? (
                  <img
                    src={shop.shopLogo}
                    alt={shop.shopName || "Shop logo"}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-white text-sm font-bold">{userInitial}</span>
                )}
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                      {user?.full_name || "My account"}
                    </p>
                    {user?.email && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                    )}
                    {shop && (
                      <p className="text-[11px] text-teal-700 dark:text-teal-400 mt-1 truncate">
                        {shop.role} · {shop.shopName || "My shop"}
                      </p>
                    )}
                  </div>
                  <Link
                    to="/settings"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Settings size={16} />
                    Settings
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-60"
                  >
                    <LogOut size={16} />
                    {signingOut ? "Signing out…" : "Sign out"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Offline status banner */}
        <OfflineBanner />

        {/* Page Content */}
        <main
          ref={scrollRef}
          className="flex-1 overflow-y-auto relative"
          style={{ overscrollBehavior: "none" }}
        >
          {/* Pull-to-Refresh Indicator */}
          {showPullIndicator && (
            <div
              className="absolute top-0 left-0 right-0 flex items-center justify-center z-10 pointer-events-none"
              style={{ height: `${pullDistance}px`, opacity: indicatorOpacity }}
            >
              <RefreshCw
                size={24}
                className="text-foreground"
                style={{
                  transform: `rotate(${indicatorRotation})`,
                  animation: refreshing ? "spin 1s linear infinite" : "none",
                }}
              />
            </div>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              <Outlet />
              {/* Spacer inside the content flow so tall pages clear the mobile bottom tab bar */}
              {location.pathname !== "/pos" && <div className="h-24 lg:hidden" />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-stretch h-16" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {[
          { icon: LayoutDashboard, label: "Home", path: "/" },
          { icon: ShoppingCart, label: "POS", path: "/pos", module: "pos" },
          { icon: Package, label: "Stock", path: "/inventory", module: "inventory" },
          { icon: Wallet, label: "Card", path: "/myspaza-card", module: "myspaza_card" },
        ].filter(t => !t.module || can(t.module)).map(t => {
          const Icon = t.icon;
          const active = location.pathname === t.path;
          return (
            <Link
              key={t.path}
              to={t.path}
              className={`flex flex-col items-center justify-center flex-1 gap-0.5 ${active ? "text-[#0D0D0D] dark:text-[#FFD426]" : "text-gray-500 dark:text-gray-400"}`}
            >
              <Icon size={22} />
              <span className="text-[10px] font-medium">{t.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex flex-col items-center justify-center flex-1 gap-0.5 text-gray-500 dark:text-gray-400"
        >
          <Menu size={22} />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>
    </div>
  );
}
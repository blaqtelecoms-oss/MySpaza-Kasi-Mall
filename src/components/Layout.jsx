import { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard, ShoppingCart, Package, TrendingUp, DollarSign,
  Users, Truck, BookOpen, BarChart2, Settings, Menu, X, Bell,
  Building2, GraduationCap, Bot, CreditCard, ChevronDown, ChevronRight,
  Banknote, UserCheck, Calculator, RefreshCw, Wallet, ArrowLeft, TrendingDown, Receipt,
  Database
} from "lucide-react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { queryClientInstance } from "@/lib/query-client";
import OfflineBanner from "@/components/OfflineBanner";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: ShoppingCart, label: "Point of Sale", path: "/pos" },
  { icon: Package, label: "Inventory", path: "/inventory" },
  { icon: Banknote, label: "Cash Up", path: "/cashup" },
  { icon: Receipt, label: "Daily Sales", path: "/daily-sales" },
  { icon: Building2, label: "Banking", path: "/banking" },
  { icon: TrendingUp, label: "Accounting", path: "/accounting" },
  { icon: DollarSign, label: "Expenses", path: "/expenses" },
  { icon: Truck, label: "Suppliers", path: "/suppliers" },
  { icon: Users, label: "Customers", path: "/customers" },
  { icon: TrendingDown, label: "Debtors Control", path: "/debtors" },
  { icon: UserCheck, label: "Employees", path: "/employees" },
  { icon: BarChart2, label: "Reports", path: "/reports" },
  { icon: GraduationCap, label: "Academy", path: "/academy" },
  { icon: Calculator, label: "Calculators", path: "/calculators" },
  { icon: Bot, label: "Spaza Coach", path: "/coach" },
  { icon: CreditCard, label: "Funding Hub", path: "/funding" },
  { icon: Wallet, label: "MySpaza Card", path: "/myspaza-card" },
  { icon: Settings, label: "Settings", path: "/settings" },
  { icon: Database, label: "Migration", path: "/migration" },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [btnRefreshing, setBtnRefreshing] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

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
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <img src="https://media.base44.com/images/public/6a4415977639497c1bfe27ef/afdb5279a_My_Spaza-removebg-preview.png" alt="My Spaza" className="w-10 h-10 rounded-xl object-cover" />
            <div>
              <h1 className="text-white font-bold text-lg leading-none tracking-tight">My Spaza</h1>
              <p className="text-white/50 text-xs">Business Manager</p>
              <p className="text-[#FFD426] text-[10px] font-semibold mt-0.5 tracking-wide uppercase">Your neighbourhood. Your store.</p>
            </div>
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

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 select-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
              (item.path !== "/" && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg mb-1 transition-all ${
                  isActive
                    ? "bg-[#FFD426] text-[#0D0D0D] font-semibold shadow-md"
                    : "text-white/70 hover:bg-white/10"
                }`}
              >
                <Icon size={18} />
                <span className="text-sm">{item.label}</span>
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
                {navItems.find(i =>
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
            <div className="w-8 h-8 bg-[#0D0D0D] rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">O</span>
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
          { icon: ShoppingCart, label: "POS", path: "/pos" },
          { icon: Package, label: "Stock", path: "/inventory" },
          { icon: Wallet, label: "Card", path: "/myspaza-card" },
        ].map(t => {
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
import { Link } from "react-router-dom";
import { useEntityQuery } from "@/hooks/useEntityQuery";
import { useQueryClient } from "@tanstack/react-query";
import QueryRefreshIndicator from "@/components/QueryRefreshIndicator";
import {
  ShoppingCart, Package, CurrencyDollar, Warning, ArrowUpRight, ArrowDownRight,
  ChartBar, Star, ArrowsClockwise, CaretRight, Truck, Receipt, Money, Robot,
  GraduationCap, TrendUp,
} from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import IconTile from "@/components/ui/icon-tile";
import AdBanner from "@/components/AdBanner";
import AcademyPromoBanner from "@/components/ads/AcademyPromoBanner";

const formatCurrency = (amount) => `R ${(amount || 0).toFixed(2)}`;
const today = new Date().toISOString().split("T")[0];

export default function Dashboard() {
  const salesQuery = useEntityQuery("Sale", "filter", [{ sale_date: today }]);
  const productsQuery = useEntityQuery("Product", "list", []);
  const expensesQuery = useEntityQuery("Expense", "filter", [{ expense_date: today }]);
  const cashupsQuery = useEntityQuery("CashUp", "filter", [{ cashup_date: today }]);
  const queryClient = useQueryClient();

  const sales = salesQuery.data || [];
  const products = productsQuery.data || [];
  const expenses = expensesQuery.data || [];
  const cashups = cashupsQuery.data || [];
  const loading = productsQuery.isLoading && !productsQuery.data;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["entities"] });

  const todaySales = sales.filter(s => s.status === "completed");
  const todayRevenue = todaySales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  const todayCash = todaySales.filter(s => s.payment_method === "cash").reduce((sum, s) => sum + s.total_amount, 0);
  const todayCard = todaySales.filter(s => s.payment_method === "card").reduce((sum, s) => sum + s.total_amount, 0);
  const todayExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const todayProfit = todayRevenue - todayExpenses;
  const stockValue = products.reduce((sum, p) => sum + ((p.cost_price || 0) * (p.stock_quantity || 0)), 0);
  const lowStockProducts = products.filter(p => p.min_stock_level && p.stock_quantity <= p.min_stock_level);
  const todayCashup = cashups[0];

  // Compute health score
  const healthScore = Math.min(100, Math.round(
    (todayRevenue > 0 ? 25 : 0) +
    (lowStockProducts.length === 0 ? 25 : Math.max(0, 25 - lowStockProducts.length * 5)) +
    (todayProfit > 0 ? 25 : 0) +
    (products.length > 0 ? 25 : 0)
  ));

  const healthColor = healthScore >= 75 ? "text-green-600" : healthScore >= 50 ? "text-yellow-600" : "text-red-600";
  const healthBg = healthScore >= 75 ? "bg-green-50 border-green-200" : healthScore >= 50 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200";

  const recentSales = [...sales].sort((a,b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 5);

  const topProducts = products
    .filter(p => p.stock_quantity !== undefined)
    .sort((a, b) => (b.selling_price || 0) - (a.selling_price || 0))
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <ArrowsClockwise className="mx-auto mb-3 animate-spin text-muted-foreground" size={40} />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#0D0D0D] to-[#1c1c1c] rounded-2xl p-4 text-white sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Welcome back</h1>
            <p className="mt-1 text-sm text-white/60">Here's how your shop is doing today</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <QueryRefreshIndicator isFetching={salesQuery.isFetching || productsQuery.isFetching} hasData={products.length > 0} />
            <button
              onClick={refresh}
              aria-label="Refresh dashboard"
              className="rounded-xl bg-white/10 p-2 transition hover:bg-white/20"
            >
              <ArrowsClockwise size={19} weight="bold" />
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="bg-white/10 rounded-xl p-2.5 text-center sm:p-3">
            <p className="text-[11px] text-white/50 sm:text-xs">Cash Sales</p>
            <p className="text-sm font-bold text-white sm:text-lg">{formatCurrency(todayCash)}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-2.5 text-center sm:p-3">
            <p className="text-[11px] text-white/50 sm:text-xs">Card Sales</p>
            <p className="text-sm font-bold text-white sm:text-lg">{formatCurrency(todayCard)}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-2.5 text-center sm:p-3">
            <p className="text-[11px] text-white/50 sm:text-xs">Transactions</p>
            <p className="text-sm font-bold text-white sm:text-lg">{todaySales.length}</p>
          </div>
        </div>
      </div>

      {/* Ad Banner */}
      <AdBanner placement="dashboard" />

      {/* Academy Promo */}
      <AcademyPromoBanner />

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          title="Today's Sales"
          value={formatCurrency(todayRevenue)}
          icon={ShoppingCart}
          tone="green"
          trend={todayRevenue > 0}
          link="/pos"
        />
        <MetricCard
          title="Today's Profit"
          value={formatCurrency(todayProfit)}
          icon={TrendUp}
          tone="teal"
          trend={todayProfit > 0}
          link="/reports"
        />
        <MetricCard
          title="Stock Value"
          value={formatCurrency(stockValue)}
          icon={Package}
          tone="blue"
          link="/inventory"
        />
        <MetricCard
          title="Today's Expenses"
          value={formatCurrency(todayExpenses)}
          icon={CurrencyDollar}
          tone="amber"
          link="/expenses"
        />
      </div>

      {/* Alerts Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Low Stock Alert */}
        <Card className={`border-2 ${lowStockProducts.length > 0 ? "border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900" : "border-border bg-muted/50"}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <IconTile icon={Warning} tone={lowStockProducts.length > 0 ? "red" : "slate"} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Low Stock Items</p>
                <p className={`text-2xl font-bold ${lowStockProducts.length > 0 ? "text-red-700 dark:text-red-400" : "text-foreground"}`}>
                  {lowStockProducts.length}
                </p>
              </div>
              <Link to="/inventory" aria-label="View low stock items" className="shrink-0 p-1">
                <CaretRight size={18} weight="bold" className="text-muted-foreground" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Business Health */}
        <Card className={`border-2 ${healthBg}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <IconTile
                icon={Star}
                tone={healthScore >= 75 ? "green" : healthScore >= 50 ? "amber" : "red"}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Business Health</p>
                <p className={`text-2xl font-bold ${healthColor}`}>{healthScore}/100</p>
              </div>
              <div className="w-12 h-12 shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="#e5e7eb" strokeWidth="3"/>
                  <circle cx="18" cy="18" r="15" fill="none"
                    stroke={healthScore >= 75 ? "#16a34a" : healthScore >= 50 ? "#ca8a04" : "#dc2626"}
                    strokeWidth="3"
                    strokeDasharray={`${(healthScore / 100) * 94} 94`}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cash Up Status */}
        <Card className={`border-2 ${todayCashup ? "border-border bg-muted/50" : "border-border"}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <IconTile icon={Money} tone="teal" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Cash Up</p>
                <p className={`text-sm font-bold ${todayCashup ? "text-foreground" : "text-muted-foreground"}`}>
                  {todayCashup ? `Status: ${todayCashup.status}` : "Not done yet"}
                </p>
              </div>
              <Link to="/cashup" className="shrink-0">
                <Button size="sm" variant={todayCashup ? "outline" : "default"} className="text-xs">
                  {todayCashup ? "View" : "Start"}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Transactions */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-foreground">Recent Transactions</CardTitle>
              <Link to="/pos" className="text-foreground text-sm font-medium hover:underline">View All</Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentSales.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart size={40} weight="duotone" className="mx-auto text-gray-300 mb-2" />
                <p className="text-muted-foreground text-sm">No sales today yet</p>
                <Link to="/pos">
                  <Button className="mt-3 bg-green-600 hover:bg-green-700 text-sm">Start Selling</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentSales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-background rounded-lg flex items-center justify-center ring-1 ring-border">
                        <ShoppingCart size={18} weight="duotone" className="text-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {sale.sale_number || `Sale #${sale.id.slice(-4)}`}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">{sale.payment_method}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-800">{formatCurrency(sale.total_amount)}</p>
                      <Badge variant="outline" className={`text-xs ${
                        sale.status === "completed" ? "border-green-300 text-green-700" : "border-amber-300 text-amber-700"
                      }`}>
                        {sale.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-foreground">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <QuickAction to="/pos" icon={ShoppingCart} label="New Sale" />
              <QuickAction to="/inventory" icon={Package} label="Add Product" />
              <QuickAction to="/cashup" icon={Money} label="Cash Up" />
              <QuickAction to="/expenses" icon={Receipt} label="Log Expense" />
              <QuickAction to="/suppliers" icon={Truck} label="Suppliers" />
              <QuickAction to="/reports" icon={ChartBar} label="Reports" />
              <QuickAction to="/coach" icon={Robot} label="Spaza Coach" />
              <QuickAction to="/academy" icon={GraduationCap} label="Academy" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Products */}
      {lowStockProducts.length > 0 && (
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                <Warning size={18} weight="duotone" /> Low Stock Alert
              </CardTitle>
              <Link to="/inventory" className="text-red-600 dark:text-red-400 text-sm font-medium hover:underline">Manage Stock</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStockProducts.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-950/30 rounded-lg">
                  <span className="text-sm font-medium text-foreground">{p.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 text-xs">
                      {p.stock_quantity} left
                    </Badge>
                    <span className="text-xs text-muted-foreground">Min: {p.min_stock_level}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricCard({ title, value, icon, trend, link, tone = "teal" }) {
  return (
    <Link to={link}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <IconTile icon={icon} tone={tone} size="sm" />
            {trend !== undefined && (
              <span className={`flex items-center gap-0.5 text-xs font-medium ${trend ? "text-green-600" : "text-red-600"}`}>
                {trend ? <ArrowUpRight size={14} weight="bold" /> : <ArrowDownRight size={14} weight="bold" />}
              </span>
            )}
          </div>
          <p className="mt-2.5 text-lg font-bold text-foreground leading-tight sm:text-2xl">{value}</p>
          <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">{title}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function QuickAction({ to, icon: Icon, label }) {
  return (
    <Link to={to}>
      <div className="rounded-xl p-3 text-center border border-border bg-muted hover:bg-foreground hover:text-background hover:border-foreground transition-colors cursor-pointer sm:p-4">
        <Icon size={24} weight="duotone" className="mx-auto mb-1.5" />
        <span className="text-xs font-semibold">{label}</span>
      </div>
    </Link>
  );
}
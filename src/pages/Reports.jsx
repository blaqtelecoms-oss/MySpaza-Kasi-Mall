import { useState } from "react";
import { useEntityQuery } from "@/hooks/useEntityQuery";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart2, TrendingUp, TrendingDown, Download, RefreshCw, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";

const formatCurrency = (n) => `R ${(n || 0).toFixed(2)}`;
const COLORS = ["#0D0D0D", "#2E9D5D", "#FFD426", "#B23D38", "#3a3a3a", "#7cc0a0"];

export default function Reports() {
  const salesQuery = useEntityQuery("Sale", "list", ["-sale_date"]);
  const expensesQuery = useEntityQuery("Expense", "list", ["-expense_date"]);
  const productsQuery = useEntityQuery("Product", "list", []);
  const queryClient = useQueryClient();
  const allSales = salesQuery.data || [];
  const allExpenses = expensesQuery.data || [];
  const products = productsQuery.data || [];
  const loading = salesQuery.isLoading && !salesQuery.data;
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);

  const sales = allSales.filter(sale => sale.sale_date >= dateFrom && sale.sale_date <= dateTo && sale.status === "completed");
  const expenses = allExpenses.filter(exp => exp.expense_date >= dateFrom && exp.expense_date <= dateTo);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["entities"] });

  const totalRevenue = sales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalProfit = totalRevenue - totalExpenses;

  // Daily sales chart
  const dailyMap = {};
  sales.forEach(s => {
    const d = s.sale_date;
    dailyMap[d] = (dailyMap[d] || 0) + s.total_amount;
  });
  const dailyData = Object.entries(dailyMap).sort().slice(-14).map(([date, amount]) => ({
    date: date.slice(5),
    amount: parseFloat(amount.toFixed(2)),
  }));

  // Payment method breakdown
  const paymentMap = {};
  sales.forEach(s => {
    paymentMap[s.payment_method] = (paymentMap[s.payment_method] || 0) + s.total_amount;
  });
  const paymentData = Object.entries(paymentMap).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));

  // Expense by category
  const expenseCatMap = {};
  expenses.forEach(e => {
    expenseCatMap[e.category] = (expenseCatMap[e.category] || 0) + e.amount;
  });
  const expenseCatData = Object.entries(expenseCatMap).sort((a,b) => b[1]-a[1]).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground text-sm">Business performance overview</p>
        </div>
        <Button variant="outline" className="gap-2"><Download size={16} /> Export</Button>
      </div>

      {/* Date Range */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="mt-1 w-38" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="mt-1 w-38" />
            </div>
            <Button onClick={refresh} className="bg-green-600 hover:bg-green-700">
              <RefreshCw size={16} className="mr-2" /> Apply
            </Button>
            <div className="flex gap-2 flex-wrap">
              {[["Today", 0], ["7 Days", 7], ["30 Days", 30], ["This Month", -1]].map(([label, days]) => (
                <button
                  key={label}
                  onClick={() => {
                    const to = new Date().toISOString().split("T")[0];
                    let from;
                    if (days === -1) {
                      from = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
                    } else {
                      const d = new Date();
                      d.setDate(d.getDate() - days);
                      from = d.toISOString().split("T")[0];
                    }
                    setDateFrom(from); setDateTo(to);
                  }}
                  className="px-3 py-1.5 bg-muted text-muted-foreground hover:bg-foreground hover:text-background rounded-lg text-xs font-medium transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12"><RefreshCw className="animate-spin mx-auto text-muted-foreground" size={32} /></div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard label="Total Revenue" value={formatCurrency(totalRevenue)} valueClass="text-green-700 dark:text-green-400" icon={<TrendingUp size={18} />} iconClass="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" />
            <SummaryCard label="Total Expenses" value={formatCurrency(totalExpenses)} valueClass="text-red-600 dark:text-red-400" icon={<TrendingDown size={18} />} iconClass="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" />
            <SummaryCard label="Net Profit" value={formatCurrency(totalProfit)} valueClass={totalProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"} icon={<BarChart2 size={18} />} iconClass={totalProfit >= 0 ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"} />
            <SummaryCard label="Transactions" value={sales.length.toString()} valueClass="text-foreground" icon={<ShoppingCart size={18} />} iconClass="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" />
          </div>

          <Tabs defaultValue="sales">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="sales">Sales</TabsTrigger>
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              <TabsTrigger value="products">Products</TabsTrigger>
            </TabsList>

            <TabsContent value="sales" className="space-y-4">
              {/* Daily Sales Chart */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Daily Sales</CardTitle></CardHeader>
                <CardContent>
                  {dailyData.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No sales data in this period</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ececec" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R${v}`} />
                        <Tooltip formatter={v => formatCurrency(v)} />
                        <Bar dataKey="amount" fill="#2E9D5D" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Payment Methods */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Sales by Payment Method</CardTitle></CardHeader>
                <CardContent>
                  {paymentData.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No data</p>
                  ) : (
                    <div className="flex flex-col md:flex-row items-center gap-4">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                            {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={v => formatCurrency(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2 w-full md:w-48">
                        {paymentData.map((pm, i) => (
                          <div key={pm.name} className="flex justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                              <span className="capitalize">{pm.name}</span>
                            </div>
                            <span className="font-semibold">{formatCurrency(pm.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="expenses" className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Expenses by Category</CardTitle></CardHeader>
                <CardContent>
                  {expenseCatData.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No expenses in this period</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={expenseCatData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#ececec" />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `R${v}`} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                        <Tooltip formatter={v => formatCurrency(v)} />
                        <Bar dataKey="value" fill="#B23D38" radius={[0,4,4,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="products">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Product Inventory Overview</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-semibold text-muted-foreground">Product</th>
                          <th className="text-right p-3 font-semibold text-muted-foreground">Price</th>
                          <th className="text-right p-3 font-semibold text-muted-foreground">Stock</th>
                          <th className="text-right p-3 font-semibold text-muted-foreground">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {products.map(p => (
                          <tr key={p.id} className="hover:bg-muted/40">
                            <td className="p-3 font-medium text-foreground">{p.name}</td>
                            <td className="p-3 text-right text-green-700 dark:text-green-400 font-semibold">{formatCurrency(p.selling_price)}</td>
                            <td className="p-3 text-right">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                p.stock_quantity <= (p.min_stock_level || 5) ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                              }`}>{p.stock_quantity ?? 0}</span>
                            </td>
                            <td className="p-3 text-right text-muted-foreground">{formatCurrency((p.cost_price || 0) * (p.stock_quantity || 0))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, valueClass, icon, iconClass }) {
  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconClass}`}>{icon}</div>
        <p className={`text-xl font-bold mt-3 ${valueClass}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}
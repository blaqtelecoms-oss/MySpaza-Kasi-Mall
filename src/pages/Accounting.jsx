import { useState } from "react";
import { useEntityQuery } from "@/hooks/useEntityQuery";
import { TrendingUp, TrendingDown, DollarSign, BarChart2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const formatCurrency = (n) => `R ${(n || 0).toFixed(2)}`;
const currentMonth = new Date().toISOString().slice(0, 7);
const currentYear = new Date().getFullYear().toString();

export default function Accounting() {
  const salesQuery = useEntityQuery("Sale", "list", ["-sale_date"]);
  const expensesQuery = useEntityQuery("Expense", "list", ["-expense_date"]);
  const productsQuery = useEntityQuery("Product", "list", []);
  const accountsQuery = useEntityQuery("BankAccount", "list", []);
  const sales = (salesQuery.data || []).filter(x => x.status === "completed");
  const expenses = expensesQuery.data || [];
  const products = productsQuery.data || [];
  const accounts = accountsQuery.data || [];
  const loading = salesQuery.isLoading && !salesQuery.data;
  const [filterMonth, setFilterMonth] = useState(currentMonth);

  const monthlySales = sales.filter(s => s.sale_date && s.sale_date.startsWith(filterMonth));
  const monthlyExpenses = expenses.filter(e => e.expense_date && e.expense_date.startsWith(filterMonth));

  const totalRevenue = monthlySales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  const totalExpenses = monthlyExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const grossProfit = totalRevenue - totalExpenses;

  const stockValue = products.reduce((sum, p) => sum + ((p.cost_price || 0) * (p.stock_quantity || 0)), 0);
  const bankBalance = accounts.reduce((sum, a) => sum + (a.current_balance || 0), 0);

  // Monthly revenue for 6 months
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }

  const monthlyData = months.map(m => {
    const rev = sales.filter(s => s.sale_date && s.sale_date.startsWith(m)).reduce((sum, s) => sum + s.total_amount, 0);
    const exp = expenses.filter(e => e.expense_date && e.expense_date.startsWith(m)).reduce((sum, e) => sum + e.amount, 0);
    return { month: m.slice(5), revenue: rev, expenses: exp, profit: rev - exp };
  });

  const expenseCats = {};
  monthlyExpenses.forEach(e => { expenseCats[e.category] = (expenseCats[e.category] || 0) + e.amount; });

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Accounting</h1>
          <p className="text-muted-foreground text-sm">Financial overview & bookkeeping</p>
        </div>
        <Input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="w-40" />
      </div>

      {loading ? (
        <div className="text-center py-12"><RefreshCw className="animate-spin mx-auto text-muted-foreground" size={32} /></div>
      ) : (
        <Tabs defaultValue="pl">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="pl">P&L</TabsTrigger>
            <TabsTrigger value="balance">Balance Sheet</TabsTrigger>
            <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
            <TabsTrigger value="ledger">Ledger</TabsTrigger>
          </TabsList>

          {/* Profit & Loss */}
          <TabsContent value="pl" className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900">
                <CardContent className="p-4">
                  <p className="text-xs text-green-600 dark:text-green-400">Revenue</p>
                  <p className="text-xl font-bold text-green-700 dark:text-green-400">{formatCurrency(totalRevenue)}</p>
                </CardContent>
              </Card>
              <Card className="bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900">
                <CardContent className="p-4">
                  <p className="text-xs text-red-600 dark:text-red-400">Expenses</p>
                  <p className="text-xl font-bold text-red-700 dark:text-red-400">{formatCurrency(totalExpenses)}</p>
                </CardContent>
              </Card>
              <Card className={`border-2 ${grossProfit >= 0 ? "bg-green-50 border-green-300 dark:bg-green-950/20 dark:border-green-900" : "bg-red-50 border-red-300 dark:bg-red-950/20 dark:border-red-900"}`}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Net Profit</p>
                  <p className={`text-xl font-bold ${grossProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>{formatCurrency(grossProfit)}</p>
                </CardContent>
              </Card>
              <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900">
                <CardContent className="p-4">
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">Margin</p>
                  <p className="text-xl font-bold text-foreground">{totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0}%</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Profit & Loss Statement — {filterMonth}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <PLRow label="Sales Revenue" amount={totalRevenue} type="income" />
                  <div className="border-t pt-2">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">EXPENSES</p>
                    {Object.entries(expenseCats).map(([cat, amount]) => (
                      <PLRow key={cat} label={cat} amount={amount} type="expense" indent />
                    ))}
                    <PLRow label="Total Expenses" amount={totalExpenses} type="expense" bold />
                  </div>
                  <div className="border-t pt-2">
                    <PLRow label="Net Profit / (Loss)" amount={grossProfit} type={grossProfit >= 0 ? "income" : "expense"} bold large />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 6-month trend */}
            <Card>
              <CardHeader><CardTitle className="text-base">6-Month Performance</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 text-muted-foreground font-medium">Month</th>
                        <th className="text-right py-2 text-muted-foreground font-medium">Revenue</th>
                        <th className="text-right py-2 text-muted-foreground font-medium">Expenses</th>
                        <th className="text-right py-2 text-muted-foreground font-medium">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyData.map(m => (
                        <tr key={m.month} className="border-b hover:bg-muted/50">
                          <td className="py-2 font-medium">{m.month}</td>
                          <td className="py-2 text-right text-green-700">{formatCurrency(m.revenue)}</td>
                          <td className="py-2 text-right text-red-600">{formatCurrency(m.expenses)}</td>
                          <td className={`py-2 text-right font-bold ${m.profit >= 0 ? "text-green-700" : "text-red-600"}`}>{formatCurrency(m.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Balance Sheet */}
          <TabsContent value="balance">
            <Card>
              <CardHeader><CardTitle className="text-base">Balance Sheet</CardTitle></CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-bold text-green-700 mb-3 flex items-center gap-2"><TrendingUp size={16} /> ASSETS</h3>
                    <div className="space-y-2">
                      <PLRow label="Cash & Bank Balance" amount={bankBalance} type="income" />
                      <PLRow label="Stock Inventory" amount={stockValue} type="income" />
                      <div className="border-t pt-2">
                        <PLRow label="Total Assets" amount={bankBalance + stockValue} type="income" bold />
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-red-600 mb-3 flex items-center gap-2"><TrendingDown size={16} /> LIABILITIES & EQUITY</h3>
                    <div className="space-y-2">
                      <PLRow label="Accumulated Profit" amount={grossProfit} type={grossProfit >= 0 ? "income" : "expense"} />
                      <PLRow label="Owner's Equity" amount={bankBalance + stockValue} type="income" />
                      <div className="border-t pt-2">
                        <PLRow label="Total L & E" amount={bankBalance + stockValue} type="income" bold />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cash Flow */}
          <TabsContent value="cashflow">
            <Card>
              <CardHeader><CardTitle className="text-base">Cash Flow Statement</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Operating Activities</h3>
                    <PLRow label="Cash from Sales" amount={monthlySales.filter(s => s.payment_method === "cash").reduce((sum, s) => sum + s.total_amount, 0)} type="income" indent />
                    <PLRow label="Card/EFT Sales" amount={monthlySales.filter(s => s.payment_method !== "cash").reduce((sum, s) => sum + s.total_amount, 0)} type="income" indent />
                    <PLRow label="Cash Expenses Paid" amount={-totalExpenses} type="expense" indent />
                    <PLRow label="Net Operating Cash" amount={totalRevenue - totalExpenses} type={totalRevenue >= totalExpenses ? "income" : "expense"} bold />
                  </div>
                  <div className="border-t pt-3">
                    <h3 className="font-semibold text-foreground mb-2">Financing Activities</h3>
                    <PLRow label="Bank Deposits" amount={bankBalance} type="income" indent />
                  </div>
                  <div className="border-t pt-3">
                    <PLRow label="Net Cash Position" amount={bankBalance + grossProfit} type={bankBalance + grossProfit >= 0 ? "income" : "expense"} bold large />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Ledger */}
          <TabsContent value="ledger">
            <Card>
              <CardHeader><CardTitle className="text-base">Transaction Ledger</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    ...monthlySales.map(s => ({ date: s.sale_date, description: `Sale ${s.sale_number || ""}`, type: "income", amount: s.total_amount })),
                    ...monthlyExpenses.map(e => ({ date: e.expense_date, description: `${e.category}: ${e.description || ""}`, type: "expense", amount: e.amount })),
                  ].sort((a, b) => b.date?.localeCompare(a.date)).slice(0, 30).map((entry, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium text-foreground">{entry.description}</p>
                        <p className="text-xs text-muted-foreground">{entry.date}</p>
                      </div>
                      <p className={`font-bold text-sm ${entry.type === "income" ? "text-green-700" : "text-red-600"}`}>
                        {entry.type === "income" ? "+" : "-"}{formatCurrency(entry.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function PLRow({ label, amount, type, indent, bold, large }) {
  return (
    <div className={`flex justify-between py-1.5 ${indent ? "pl-4" : ""}`}>
      <span className={`${bold ? "font-bold" : "text-sm"} ${large ? "text-base" : ""} text-foreground`}>{label}</span>
      <span className={`${bold ? "font-bold" : "font-medium text-sm"} ${large ? "text-lg" : ""} ${type === "income" ? "text-green-700" : "text-red-600"}`}>
        {formatCurrency(Math.abs(amount))}
      </span>
    </div>
  );
}
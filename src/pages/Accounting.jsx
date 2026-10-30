import { useState } from "react";
import { useEntityQuery } from "@/hooks/useEntityQuery";
import { TrendUp, TrendDown, Money, Percent, ArrowsClockwise } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">Accounting</h1>
          <p className="text-sm text-muted-foreground">Financial overview & bookkeeping</p>
        </div>
        <Input
          type="month"
          aria-label="Reporting month"
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          className="w-full sm:w-40"
        />
      </div>

      {loading ? (
        <div className="text-center py-12"><ArrowsClockwise className="animate-spin mx-auto text-muted-foreground" size={32} /></div>
      ) : (
        <Tabs defaultValue="pl">
          <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="pl" className="text-xs sm:text-sm">P&L</TabsTrigger>
            <TabsTrigger value="balance" className="text-xs sm:text-sm">Balance Sheet</TabsTrigger>
            <TabsTrigger value="cashflow" className="text-xs sm:text-sm">Cash Flow</TabsTrigger>
            <TabsTrigger value="ledger" className="text-xs sm:text-sm">Ledger</TabsTrigger>
          </TabsList>

          {/* Profit & Loss */}
          <TabsContent value="pl" className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              <Card className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900">
                <CardContent className="p-3 sm:p-4">
                  <p className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                    <TrendUp size={13} weight="duotone" className="shrink-0" /> Revenue
                  </p>
                  <p className="mt-0.5 text-base font-bold tabular-nums text-green-700 dark:text-green-400 sm:text-xl">{formatCurrency(totalRevenue)}</p>
                </CardContent>
              </Card>
              <Card className="bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900">
                <CardContent className="p-3 sm:p-4">
                  <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                    <TrendDown size={13} weight="duotone" className="shrink-0" /> Expenses
                  </p>
                  <p className="mt-0.5 text-base font-bold tabular-nums text-red-700 dark:text-red-400 sm:text-xl">{formatCurrency(totalExpenses)}</p>
                </CardContent>
              </Card>
              <Card className={`border-2 ${grossProfit >= 0 ? "bg-green-50 border-green-300 dark:bg-green-950/20 dark:border-green-900" : "bg-red-50 border-red-300 dark:bg-red-950/20 dark:border-red-900"}`}>
                <CardContent className="p-3 sm:p-4">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Money size={13} weight="duotone" className="shrink-0" /> Net Profit
                  </p>
                  <p className={`mt-0.5 text-base font-bold tabular-nums sm:text-xl ${grossProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>{formatCurrency(grossProfit)}</p>
                </CardContent>
              </Card>
              <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900">
                <CardContent className="p-3 sm:p-4">
                  <p className="flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-400">
                    <Percent size={13} weight="duotone" className="shrink-0" /> Margin
                  </p>
                  <p className="mt-0.5 text-base font-bold tabular-nums text-foreground sm:text-xl">{totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0}%</p>
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
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 text-left font-medium text-muted-foreground">Month</th>
                        <th className="py-2 text-right font-medium text-muted-foreground">Revenue</th>
                        <th className="py-2 text-right font-medium text-muted-foreground">Expenses</th>
                        <th className="py-2 text-right font-medium text-muted-foreground">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyData.map(m => (
                        <tr key={m.month} className="border-b hover:bg-muted/50">
                          <td className="whitespace-nowrap py-2 font-medium">{m.month}</td>
                          <td className="whitespace-nowrap py-2 text-right tabular-nums text-green-700">{formatCurrency(m.revenue)}</td>
                          <td className="whitespace-nowrap py-2 text-right tabular-nums text-red-600">{formatCurrency(m.expenses)}</td>
                          <td className={`whitespace-nowrap py-2 text-right font-bold tabular-nums ${m.profit >= 0 ? "text-green-700" : "text-red-600"}`}>{formatCurrency(m.profit)}</td>
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
                    <h3 className="font-bold text-green-700 mb-3 flex items-center gap-2"><TrendUp size={16} weight="duotone" /> ASSETS</h3>
                    <div className="space-y-2">
                      <PLRow label="Cash & Bank Balance" amount={bankBalance} type="income" />
                      <PLRow label="Stock Inventory" amount={stockValue} type="income" />
                      <div className="border-t pt-2">
                        <PLRow label="Total Assets" amount={bankBalance + stockValue} type="income" bold />
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-red-600 mb-3 flex items-center gap-2"><TrendDown size={16} weight="duotone" /> LIABILITIES & EQUITY</h3>
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
                    <div key={i} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{entry.description}</p>
                        <p className="text-xs text-muted-foreground">{entry.date}</p>
                      </div>
                      <p className={`shrink-0 whitespace-nowrap text-sm font-bold tabular-nums ${entry.type === "income" ? "text-green-700" : "text-red-600"}`}>
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
    <div className={`flex items-start justify-between gap-3 py-1.5 ${indent ? "pl-4" : ""}`}>
      <span className={`min-w-0 break-words ${bold ? "font-bold" : "text-sm"} ${large ? "text-base" : ""} text-foreground`}>{label}</span>
      <span className={`shrink-0 whitespace-nowrap tabular-nums ${bold ? "font-bold" : "font-medium text-sm"} ${large ? "text-lg" : ""} ${type === "income" ? "text-green-700" : "text-red-600"}`}>
        {formatCurrency(Math.abs(amount))}
      </span>
    </div>
  );
}
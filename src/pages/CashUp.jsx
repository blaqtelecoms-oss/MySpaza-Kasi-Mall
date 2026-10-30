import { useState, useEffect, useRef } from "react";
import { api } from "@/api/client";
import { useEntityQuery, useInvalidateEntity } from "@/hooks/useEntityQuery";
import QueryRefreshIndicator from "@/components/QueryRefreshIndicator";
import {
  Money, CheckCircle, WarningCircle, Bank, ClockCounterClockwise, Cards,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

const formatCurrency = (n) => `R ${(n || 0).toFixed(2)}`;
const today = new Date().toISOString().split("T")[0];

export default function CashUp() {
  const salesQuery = useEntityQuery("Sale", "filter", [{ sale_date: today }]);
  const cashupsQuery = useEntityQuery("CashUp", "list", ["-cashup_date", 10]);
  const invalidateSale = useInvalidateEntity();
  const invalidateCashUp = useInvalidateEntity();
  const todaySales = salesQuery.data || [];
  const cashups = cashupsQuery.data || [];
  const todayCashup = cashups.find(c => c.cashup_date === today) || null;
  const [form, setForm] = useState({
    cashup_date: today,
    opening_float: "", cash_sales: "", card_sales: "",
    eft_sales: "", credit_sales: "", other_sales: "", expenses_paid: "",
    cash_withdrawals: "", bank_deposits: "", actual_cash: "",
    notes: "", cashier_name: "Owner",
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // The sales breakdown always mirrors today's completed sales on the system,
  // so new sales show up immediately (not just the ones that existed on first
  // load). The reconciliation fields (opening float, expenses, withdrawals,
  // deposits, actual cash, notes) are the user's manual inputs. To avoid
  // clobbering anything the user typed, we track manually-edited fields and
  // never overwrite them — neither from a refetch nor from a saved cashup.
  const manualEdits = useRef(new Set());
  const handleChange = (field, value) => {
    manualEdits.current.add(field);
    setForm(prev => ({ ...prev, [field]: value }));
  };
  const numStr = (n) => (n === undefined || n === null || isNaN(n) ? "" : String(n));

  // Live-sync the sales breakdown from today's completed sales.
  useEffect(() => {
    if (salesQuery.data === undefined) return;
    const completed = todaySales.filter(s => s.status === "completed");
    const sumBy = (method) => completed
      .filter(s => method === "other" ? !["cash","card","eft","credit"].includes(s.payment_method) : s.payment_method === method)
      .reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const sums = {
      cash_sales: sumBy("cash"),
      card_sales: sumBy("card"),
      eft_sales: sumBy("eft"),
      credit_sales: sumBy("credit"),
      other_sales: sumBy("other"),
    };
    setForm(prev => {
      const next = { ...prev };
      for (const k of Object.keys(sums)) {
        if (!manualEdits.current.has(k)) next[k] = sums[k].toFixed(2);
      }
      return next;
    });
  }, [todaySales, salesQuery.data]);

  // One-time load of the reconciliation fields from an existing cashup for
  // today, so a saved reconciliation is visible instead of a blank form.
  const didLoadCashup = useRef(false);
  useEffect(() => {
    if (didLoadCashup.current) return;
    if (cashupsQuery.data === undefined) return;
    if (todayCashup) {
      setForm(prev => {
        const next = { ...prev };
        const fields = {
          opening_float: numStr(todayCashup.opening_float),
          expenses_paid: numStr(todayCashup.expenses_paid),
          cash_withdrawals: numStr(todayCashup.cash_withdrawals),
          bank_deposits: numStr(todayCashup.bank_deposits),
          actual_cash: numStr(todayCashup.actual_cash),
          notes: todayCashup.notes || "",
          cashier_name: todayCashup.cashier_name || "Owner",
        };
        for (const [k, val] of Object.entries(fields)) {
          if (!manualEdits.current.has(k)) next[k] = val;
        }
        return next;
      });
    }
    didLoadCashup.current = true;
  }, [todayCashup, cashupsQuery.data]);

  const v = (field) => parseFloat(form[field]) || 0;

  const totalSales = v("cash_sales") + v("card_sales") + v("eft_sales") + v("credit_sales") + v("other_sales");
  const expectedCash = v("opening_float") + v("cash_sales") - v("expenses_paid") - v("cash_withdrawals") - v("bank_deposits");
  const cashDifference = v("actual_cash") - expectedCash;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const data = {
        ...form,
        opening_float: v("opening_float"),
        cash_sales: v("cash_sales"),
        card_sales: v("card_sales"),
        eft_sales: v("eft_sales"),
        credit_sales: v("credit_sales"),
        other_sales: v("other_sales"),
        total_sales: totalSales,
        expenses_paid: v("expenses_paid"),
        cash_withdrawals: v("cash_withdrawals"),
        bank_deposits: v("bank_deposits"),
        expected_cash: expectedCash,
        actual_cash: v("actual_cash"),
        cash_difference: cashDifference,
        status: "draft",
      };
      if (todayCashup) {
        await api.entities.CashUp.update(todayCashup.id, data);
        toast({ title: "Cash Up Updated" });
      } else {
        await api.entities.CashUp.create(data);
        toast({ title: "Cash Up Saved" });
      }
      invalidateSale("Sale");
      invalidateCashUp("CashUp");
    } catch (err) {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    }
    setSaving(false);
  };

  const inputField = (label, field, readOnly = false) => (
    <div>
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <div className="relative mt-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">R</span>
        <Input
          type="number"
          className="pl-7"
          value={form[field]}
          onChange={e => handleChange(field, e.target.value)}
          readOnly={readOnly}
          step="0.01"
          placeholder="0.00"
        />
      </div>
    </div>
  );

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">Daily Cash Up</h1>
            <QueryRefreshIndicator isFetching={salesQuery.isFetching || cashupsQuery.isFetching} hasData={cashups.length > 0 || todaySales.length > 0} />
          </div>
          <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString("en-ZA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        {todayCashup && <Badge className="shrink-0 bg-green-100 px-3 py-1 text-green-700 dark:bg-green-900/40 dark:text-green-300"><CheckCircle size={12} weight="fill" className="mr-1" />Completed</Badge>}
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="bg-muted border-border">
          <CardContent className="p-2.5 text-center sm:p-3">
            <Cards size={18} weight="duotone" className="mx-auto mb-1 text-slate-500" />
            <p className="text-lg font-bold leading-tight text-foreground sm:text-2xl">{todaySales.filter(s => s.status === "completed").length}</p>
            <p className="text-[11px] leading-tight text-muted-foreground sm:text-xs">Transactions</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900">
          <CardContent className="p-2.5 text-center sm:p-3">
            <Money size={18} weight="duotone" className="mx-auto mb-1 text-green-700" />
            <p className="text-sm font-bold leading-tight text-green-700 tabular-nums dark:text-green-400 sm:text-xl">{formatCurrency(totalSales)}</p>
            <p className="text-[11px] leading-tight text-green-600 dark:text-green-400 sm:text-xs">Total Sales</p>
          </CardContent>
        </Card>
        <Card className={`border-2 ${Math.abs(cashDifference) > 10 ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900" : "bg-muted border-border"}`}>
          <CardContent className="p-2.5 text-center sm:p-3">
            <WarningCircle
              size={18}
              weight="duotone"
              className={`mx-auto mb-1 ${Math.abs(cashDifference) > 10 ? "text-red-600" : "text-slate-400"}`}
            />
            <p className={`text-sm font-bold leading-tight tabular-nums sm:text-xl ${cashDifference > 0 ? "text-green-600 dark:text-green-400" : cashDifference < 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
              {cashDifference >= 0 ? "+" : ""}{formatCurrency(cashDifference)}
            </p>
            <p className="text-[11px] leading-tight text-muted-foreground sm:text-xs">Difference</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sales Section */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Money size={18} weight="duotone" className="text-slate-600" /> Sales Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {inputField("Opening Float", "opening_float")}
            {inputField("Cash Sales", "cash_sales")}
            {inputField("Card Sales", "card_sales")}
            {inputField("EFT Sales", "eft_sales")}
            {inputField("Credit Sales", "credit_sales")}
            {inputField("Other Sales", "other_sales")}
            <div className="bg-green-50 dark:bg-green-950/20 rounded-xl p-3 flex justify-between">
              <span className="font-semibold text-foreground">Total Sales</span>
              <span className="font-bold text-green-700 dark:text-green-400">{formatCurrency(totalSales)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Cash Section */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Bank size={18} weight="duotone" className="text-slate-600" /> Cash Reconciliation</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {inputField("Expenses Paid (Cash)", "expenses_paid")}
            {inputField("Cash Withdrawals", "cash_withdrawals")}
            {inputField("Bank Deposits", "bank_deposits")}

            <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-xl p-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Expected Cash in Till</span>
                <span className="font-bold text-foreground">{formatCurrency(expectedCash)}</span>
              </div>
            </div>

            {inputField("Actual Cash Counted", "actual_cash")}

            <div className={`rounded-xl p-3 ${Math.abs(cashDifference) > 10 ? "bg-red-50 dark:bg-red-950/20" : "bg-green-50 dark:bg-green-950/20"}`}>
              <div className="flex justify-between">
                <span className="font-semibold text-foreground">Cash Difference</span>
                <span className={`font-bold ${cashDifference >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                  {cashDifference >= 0 ? "+" : ""}{formatCurrency(cashDifference)}
                </span>
              </div>
              {Math.abs(cashDifference) > 10 && (
                <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                  <WarningCircle size={12} weight="bold" /> Large difference — please investigate
                </p>
              )}
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">Cashier Name</Label>
              <Input className="mt-1" value={form.cashier_name} onChange={e => handleChange("cashier_name", e.target.value)} />
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">Notes</Label>
              <Input className="mt-1" placeholder="Any notes..." value={form.notes} onChange={e => handleChange("notes", e.target.value)} />
            </div>

            <Button onClick={handleSubmit} disabled={saving} className="w-full bg-green-600 hover:bg-green-700 h-12 font-bold">
              <CheckCircle size={18} weight="bold" className="mr-2" />
              {saving ? "Saving..." : todayCashup ? "Update Cash Up" : "Submit Cash Up"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      {cashups.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><ClockCounterClockwise size={18} weight="duotone" className="text-slate-600" /> Recent Cash Ups</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cashups.slice(0, 5).map(cu => (
                <div key={cu.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted p-3">
                  <div>
                    <p className="font-medium text-sm text-foreground">{cu.cashup_date}</p>
                    <p className="text-xs text-muted-foreground">{cu.cashier_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-700 dark:text-green-400">{formatCurrency(cu.total_sales)}</p>
                    <p className={`text-xs ${(cu.cash_difference || 0) < 0 ? "text-red-500 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                      Diff: {formatCurrency(cu.cash_difference)}
                    </p>
                  </div>
                  <Badge className={cu.status === "approved" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"}>
                    {cu.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
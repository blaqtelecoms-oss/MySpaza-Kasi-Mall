import { useState } from "react";
import { api } from "@/api/client";
import { useEntityQuery, useInvalidateEntity } from "@/hooks/useEntityQuery";
import QueryRefreshIndicator from "@/components/QueryRefreshIndicator";
import { Plus, Trash2, RefreshCw, Upload, Receipt, Fuel, Lightbulb, Droplet, Home, Bus, User, Sparkles, Lock, Wrench, Megaphone, Package, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MobileSelect } from "@/components/ui/mobile-select";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/ui/use-toast";

const formatCurrency = (n) => `R ${(n || 0).toFixed(2)}`;
const today = new Date().toISOString().split("T")[0];

const EXPENSE_CATEGORIES = [
  { id: "fuel", label: "Fuel", icon: <Fuel size={20} className="text-red-600 dark:text-red-400" /> },
  { id: "electricity", label: "Electricity", icon: <Lightbulb size={20} className="text-red-600 dark:text-red-400" /> },
  { id: "water", label: "Water", icon: <Droplet size={20} className="text-red-600 dark:text-red-400" /> },
  { id: "rent", label: "Rent", icon: <Home size={20} className="text-red-600 dark:text-red-400" /> },
  { id: "transport", label: "Transport", icon: <Bus size={20} className="text-red-600 dark:text-red-400" /> },
  { id: "salary", label: "Employee Salary", icon: <User size={20} className="text-red-600 dark:text-red-400" /> },
  { id: "cleaning", label: "Cleaning", icon: <Sparkles size={20} className="text-red-600 dark:text-red-400" /> },
  { id: "security", label: "Security", icon: <Lock size={20} className="text-red-600 dark:text-red-400" /> },
  { id: "repairs", label: "Repairs", icon: <Wrench size={20} className="text-red-600 dark:text-red-400" /> },
  { id: "advertising", label: "Advertising", icon: <Megaphone size={20} className="text-red-600 dark:text-red-400" /> },
  { id: "stock_purchase", label: "Stock Purchase", icon: <Package size={20} className="text-red-600 dark:text-red-400" /> },
  { id: "other", label: "Other", icon: <FileText size={20} className="text-red-600 dark:text-red-400" /> },
];

const emptyForm = {
  category: "", description: "", amount: "",
  expense_date: today, payment_method: "cash", notes: ""
};

export default function Expenses() {
  const expensesQuery = useEntityQuery("Expense", "list", ["-expense_date"]);
  const allExpenses = expensesQuery.data || [];
  const loading = expensesQuery.isLoading && !expensesQuery.data;
  const invalidateExpense = useInvalidateEntity();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filterMonth, setFilterMonth] = useState(today.slice(0, 7));
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { toast } = useToast();

  const expenses = allExpenses.filter(e => e.expense_date && e.expense_date.startsWith(filterMonth));

  const handleSave = async () => {
    if (!form.category || !form.amount || !form.expense_date) {
      toast({ title: "Required Fields", description: "Category, amount and date are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.entities.Expense.create({ ...form, amount: parseFloat(form.amount) });
      toast({ title: "Expense Logged", description: `${form.category} — ${formatCurrency(parseFloat(form.amount))}` });
      setModalOpen(false);
      setForm(emptyForm);
      invalidateExpense("Expense");
    } catch (err) {
      toast({ title: "Error", description: "Failed to save expense", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = (e) => setDeleteTarget(e);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await api.entities.Expense.delete(deleteTarget.id);
    setDeleteTarget(null);
    invalidateExpense("Expense");
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const byCategory = EXPENSE_CATEGORIES.map(cat => ({
    ...cat,
    total: expenses.filter(e => e.category === cat.id).reduce((sum, e) => sum + e.amount, 0)
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
            <QueryRefreshIndicator isFetching={expensesQuery.isFetching} hasData={allExpenses.length > 0} />
          </div>
          <p className="text-muted-foreground text-sm">Track all business expenses</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="bg-green-600 hover:bg-green-700 gap-2">
          <Plus size={18} /> Add Expense
        </Button>
      </div>

      {/* Month filter + total */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">Month:</Label>
          <Input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="w-40" />
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total Expenses</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
        </div>
      </div>

      {/* Category Breakdown */}
      {byCategory.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Expense Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {byCategory.map(cat => (
                <div key={cat.id} className="bg-red-50 dark:bg-red-950/20 rounded-xl p-3 flex items-center gap-2">
                  {cat.icon}
                  <div>
                    <p className="text-xs text-muted-foreground">{cat.label}</p>
                    <p className="font-bold text-red-700 dark:text-red-400 text-sm">{formatCurrency(cat.total)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Expense Buttons */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Quick Add</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {EXPENSE_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => { setForm({...emptyForm, category: cat.id}); setModalOpen(true); }}
                className="flex flex-col items-center gap-1 p-3 bg-muted hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors"
              >
                {cat.icon}
                <span className="text-xs text-muted-foreground text-center leading-tight">{cat.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Expense List */}
      {loading ? (
        <div className="text-center py-8"><RefreshCw className="animate-spin mx-auto text-muted-foreground" size={28} /></div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-2xl border border-border">
          <Receipt size={40} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No expenses recorded this month</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {expenses.map(e => {
                const cat = EXPENSE_CATEGORIES.find(c => c.id === e.category);
                return (
                  <div key={e.id} className="flex items-center justify-between p-4 hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-100 dark:bg-red-900/40 rounded-xl flex items-center justify-center">
                        {cat?.icon || <FileText size={20} className="text-red-600 dark:text-red-400" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-foreground">{e.description || cat?.label}</p>
                        <p className="text-xs text-muted-foreground">{e.expense_date} · {e.payment_method}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-red-600">{formatCurrency(e.amount)}</p>
                      <button onClick={() => handleDelete(e)} className="p-2">
                        <Trash2 size={18} className="text-muted-foreground hover:text-red-500" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Expense Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Log Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category *</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {EXPENSE_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setForm({...form, category: cat.id})}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                      form.category === cat.id ? "border-green-500 bg-green-50 dark:bg-green-950/30" : "border-border"
                    }`}
                  >
                    {cat.icon}
                    <span className="text-xs text-muted-foreground text-center leading-tight">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Amount (R) *</Label>
              <Input type="number" placeholder="0.00" value={form.amount}
                onChange={e => setForm({...form, amount: e.target.value})} className="mt-1 h-12 text-xl text-center" />
            </div>
            <div>
              <Label>Description</Label>
              <Input placeholder="What was this for?" value={form.description}
                onChange={e => setForm({...form, description: e.target.value})} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date *</Label>
                <Input type="date" value={form.expense_date}
                  onChange={e => setForm({...form, expense_date: e.target.value})} className="mt-1" />
              </div>
              <div>
                <Label>Payment</Label>
                <MobileSelect
                  value={form.payment_method}
                  onValueChange={v => setForm({...form, payment_method: v})}
                  placeholder="Payment"
                  triggerClassName="mt-1"
                  options={[
                    { value: "cash", label: "Cash" },
                    { value: "card", label: "Card" },
                    { value: "eft", label: "EFT" },
                  ]}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700">
                {saving ? "Saving..." : "Save Expense"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Expense"
        description="Are you sure you want to delete this expense? This action cannot be undone."
        onConfirm={confirmDelete}
      />
    </div>
  );
}
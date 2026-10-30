import { useState } from "react";
import { api } from "@/api/client";
import { useEntityQuery, useInvalidateEntity } from "@/hooks/useEntityQuery";
import QueryRefreshIndicator from "@/components/QueryRefreshIndicator";
import { Plus, Building2, RefreshCw, ArrowDownLeft, ArrowUpRight, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MobileSelect } from "@/components/ui/mobile-select";
import { useToast } from "@/components/ui/use-toast";

const formatCurrency = (n) => `R ${(n || 0).toFixed(2)}`;
const emptyAccount = { bank_name: "", account_name: "", account_number: "", account_type: "cheque", branch_code: "", current_balance: "", is_primary: false, is_active: true, notes: "" };

const SA_BANKS = ["ABSA", "FNB (First National Bank)", "Nedbank", "Standard Bank", "Capitec Bank", "African Bank", "TymeBank", "Discovery Bank", "Investec", "Bidvest Bank", "Other"];

export default function Banking() {
  const accountsQuery = useEntityQuery("BankAccount", "list", []);
  const accounts = accountsQuery.data || [];
  const loading = accountsQuery.isLoading && !accountsQuery.data;
  const invalidateAccount = useInvalidateEntity();
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyAccount);
  const [saving, setSaving] = useState(false);
  const [depositModal, setDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositAccount, setDepositAccount] = useState("");
  const [depositNote, setDepositNote] = useState("");
  const { toast } = useToast();

  const openNew = () => { setEditItem(null); setForm(emptyAccount); setModalOpen(true); };
  const openEdit = (a) => { setEditItem(a); setForm({...a}); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.bank_name || !form.account_name) { toast({ title: "Required fields missing", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const data = { ...form, current_balance: parseFloat(form.current_balance) || 0 };
      if (editItem) {
        await api.entities.BankAccount.update(editItem.id, data);
        toast({ title: "Account Updated" });
      } else {
        await api.entities.BankAccount.create(data);
        toast({ title: "Account Added" });
      }
      setModalOpen(false);
      invalidateAccount("BankAccount");
    } catch { toast({ title: "Error", variant: "destructive" }); }
    setSaving(false);
  };

  const handleDeposit = async () => {
    if (!depositAmount || !depositAccount) { toast({ title: "Please fill all fields", variant: "destructive" }); return; }
    const account = accounts.find(a => a.id === depositAccount);
    if (!account) return;
    await api.entities.BankAccount.update(depositAccount, {
      current_balance: (account.current_balance || 0) + parseFloat(depositAmount)
    });
    toast({ title: "Deposit Recorded", description: `${formatCurrency(parseFloat(depositAmount))} deposited` });
    setDepositModal(false);
    setDepositAmount("");
    setDepositNote("");
    invalidateAccount("BankAccount");
  };

  const totalBalance = accounts.reduce((sum, a) => sum + (a.current_balance || 0), 0);

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">Banking</h1>
            <QueryRefreshIndicator isFetching={accountsQuery.isFetching} hasData={accounts.length > 0} />
          </div>
          <p className="text-sm text-muted-foreground">Total balance: <span className="font-bold text-green-700 dark:text-green-400">{formatCurrency(totalBalance)}</span></p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setDepositModal(true)} variant="outline" className="hidden gap-2 sm:flex">
            <ArrowDownLeft size={16} /> Deposit
          </Button>
          <Button onClick={openNew} className="gap-2 bg-green-600 hover:bg-green-700">
            <Plus size={16} /> Add Account
          </Button>
        </div>
      </div>

      {/* Total Balance Card */}
      <div className="bg-gradient-to-r from-[#0D0D0D] to-[#1c1c1c] rounded-2xl p-4 text-white sm:p-6">
        <p className="text-sm text-white/60">Total Bank Balance</p>
        <p className="mt-1 text-3xl font-bold tabular-nums sm:text-4xl">{formatCurrency(totalBalance)}</p>
        <div className="mt-4 flex flex-wrap gap-2 sm:gap-3">
          <button onClick={() => setDepositModal(true)} className="flex items-center gap-2 bg-white/20 hover:bg-white/30 rounded-xl px-4 py-2 text-sm transition">
            <ArrowDownLeft size={16} /> Deposit
          </button>
          <button className="flex items-center gap-2 bg-white/20 hover:bg-white/30 rounded-xl px-4 py-2 text-sm transition">
            <ArrowUpRight size={16} /> Withdraw
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8"><RefreshCw className="animate-spin mx-auto text-muted-foreground" size={28} /></div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-2xl border border-border">
          <Building2 size={48} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No bank accounts added yet</p>
          <Button onClick={openNew} className="mt-3 bg-green-600 hover:bg-green-700">Add Bank Account</Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {accounts.map(account => (
            <Card key={account.id} className={`hover:shadow-md transition-shadow ${account.is_primary ? "border-2 border-green-400" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center">
                      <Building2 size={22} className="text-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-foreground">{account.bank_name}</h3>
                        {account.is_primary && <Badge className="bg-green-100 text-green-700 text-xs">Primary</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{account.account_name}</p>
                      <p className="text-xs text-muted-foreground">{account.account_type} · {account.account_number}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-green-700 dark:text-green-400">{formatCurrency(account.current_balance)}</p>
                    <div className="flex gap-1 justify-end mt-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(account)}>
                        <Edit size={14} className="text-foreground" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Account Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editItem ? "Edit Account" : "Add Bank Account"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Bank *</Label>
              <MobileSelect
                value={form.bank_name}
                onValueChange={v => setForm({...form, bank_name: v})}
                placeholder="Select bank"
                triggerClassName="mt-1"
                options={SA_BANKS.map(b => ({ value: b, label: b }))}
              />
            </div>
            {[["account_name","Account Name *"], ["account_number","Account Number"], ["branch_code","Branch Code"]].map(([f, l]) => (
              <div key={f}>
                <Label>{l}</Label>
                <Input className="mt-1" value={form[f]} onChange={e => setForm({...form, [f]: e.target.value})} />
              </div>
            ))}
            <div>
              <Label>Account Type</Label>
              <MobileSelect
                value={form.account_type}
                onValueChange={v => setForm({...form, account_type: v})}
                placeholder="Account Type"
                triggerClassName="mt-1"
                options={[
                  { value: "cheque", label: "Cheque" },
                  { value: "savings", label: "Savings" },
                  { value: "business", label: "Business" },
                  { value: "transmission", label: "Transmission" },
                ]}
              />
            </div>
            <div>
              <Label>Current Balance (R)</Label>
              <Input className="mt-1" type="number" value={form.current_balance} onChange={e => setForm({...form, current_balance: e.target.value})} />
            </div>
          </div>
          <div className="flex gap-2 pt-3">
            <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700">
              {saving ? "Saving..." : editItem ? "Update" : "Add Account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deposit Modal */}
      <Dialog open={depositModal} onOpenChange={setDepositModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record Deposit</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Bank Account</Label>
              <MobileSelect
                value={depositAccount}
                onValueChange={setDepositAccount}
                placeholder="Select account"
                triggerClassName="mt-1"
                options={accounts.map(a => ({ value: a.id, label: `${a.bank_name} — ${a.account_name}` }))}
              />
            </div>
            <div>
              <Label>Amount (R)</Label>
              <Input className="mt-1 h-14 text-2xl text-center" type="number" placeholder="0.00" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
            </div>
            <div>
              <Label>Reference / Notes</Label>
              <Input className="mt-1" placeholder="e.g. Daily cash deposit" value={depositNote} onChange={e => setDepositNote(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDepositModal(false)}>Cancel</Button>
              <Button onClick={handleDeposit} className="flex-1 bg-green-600 hover:bg-green-700">Record Deposit</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
import { useState, useEffect } from "react";
import { api } from "@/api/client";
import { useEntityQuery, useInvalidateEntity } from "@/hooks/useEntityQuery";
import { PiggyBank, Plus, ArrowDownCircle, ArrowUpCircle, Target, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import GroupInvites from "@/components/myspazacard/GroupInvites";
import { useToast } from "@/components/ui/use-toast";

const fmt = (a) => "R " + Number(a || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * The shop's stokvel: one savings account per shop, saved toward stock and
 * bulk buying. Friends the owner invites from here are emailed a link and join
 * the member list once they accept.
 */
export default function StokvelTab() {
  const accountQuery = useEntityQuery("StockfellAccount", "list", []);
  const invalidateStokvel = useInvalidateEntity();
  const [account, setAccount] = useState(null);
  const [action, setAction] = useState(null); // "deposit" | "withdraw" | "setup"
  const { toast } = useToast();

  useEffect(() => { setAccount((accountQuery.data || [])[0] || null); }, [accountQuery.data]);
  const loading = accountQuery.isLoading && !accountQuery.data;

  const save = async (data) => {
    if (account) {
      await api.entities.StockfellAccount.update(account.id, data);
    } else {
      const created = await api.entities.StockfellAccount.create(data);
      setAccount(created);
    }
    invalidateStokvel("StockfellAccount");
  };

  if (loading) return <div className="text-center py-8 text-gray-400">Loading...</div>;

  if (!account) {
    return (
      <div className="text-center py-10">
        <PiggyBank size={48} className="mx-auto mb-3 text-green-200" />
        <h3 className="font-semibold text-gray-800">Open your stokvel</h3>
        <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">A savings account linked to your MySpaza Card. Save toward stock and bulk buying with your stokvel.</p>
        <Button onClick={() => setAction("setup")} className="bg-green-600 hover:bg-green-700"><Plus size={16} /> Open stokvel</Button>
        {action === "setup" && <SetupForm onClose={() => setAction(null)} onSaved={(d) => { setAction(null); save(d); }} />}
      </div>
    );
  }

  const progress = account.target_amount > 0 ? Math.min(100, (account.balance / account.target_amount) * 100) : 0;
  const members = account.members || [];

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-green-700 to-green-900 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-200 text-xs">Stokvel balance</p>
            <p className="text-3xl font-bold">{fmt(account.balance)}</p>
          </div>
          <PiggyBank size={40} className="text-yellow-400" />
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-green-200 mb-1">
            <span>Target: {fmt(account.target_amount)}</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="h-2.5 bg-green-950/50 rounded-full overflow-hidden">
            <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white border rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500">Monthly</p>
          <p className="font-bold text-gray-800">{fmt(account.monthly_contribution)}</p>
        </div>
        <div className="bg-white border rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500">Total Saved</p>
          <p className="font-bold text-gray-800">{fmt(account.total_contributed)}</p>
        </div>
        <div className="bg-white border rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500">Withdrawn</p>
          <p className="font-bold text-gray-800">{fmt(account.total_withdrawn)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => setAction("deposit")} className="bg-green-600 hover:bg-green-700 h-12">
          <ArrowDownCircle size={18} /> Add to Savings
        </Button>
        <Button onClick={() => setAction("withdraw")} variant="outline" className="h-12 border-green-200 text-green-700">
          <ArrowUpCircle size={18} /> Withdraw
        </Button>
      </div>

      <div className="bg-white border rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1"><Target size={13} /> Account Details</p>
        <dl className="text-sm space-y-1">
          <div className="flex justify-between"><dt className="text-gray-500">Holder</dt><dd className="font-medium">{account.account_holder}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">Status</dt><dd className="font-medium capitalize">{account.status}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">Last contribution</dt><dd className="font-medium">{account.last_contribution_date || "—"}</dd></div>
        </dl>
      </div>

      <div className="bg-white border rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1"><Users size={13} /> Members</p>
        {members.length === 0 ? (
          <p className="text-xs text-gray-400">Only you so far — invite your friends below.</p>
        ) : (
          <div className="space-y-1">
            {members.map((m, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="truncate text-gray-700">{m.name}{m.email ? <span className="text-gray-400"> · {m.email}</span> : null}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-gray-500">{fmt(m.contributed)}</span>
                  {m.status === "paid" ? (
                    <Badge className="text-[9px] bg-green-100 text-green-700">paid</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px]">pending</Badge>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
        <GroupInvites groupKind="stokvel" groupId={account.id} groupName="this stokvel" />
      </div>

      {action === "deposit" && (
        <AmountDialog title="Add to Stokvel Savings" onClose={() => setAction(null)}
          onSubmit={(amt) => {
            if (!amt || amt <= 0) return;
            const today = new Date().toISOString().split("T")[0];
            setAccount(prev => prev ? { ...prev, balance: prev.balance + amt, total_contributed: prev.total_contributed + amt, last_contribution_date: today } : prev);
            toast({ title: "Saved", description: fmt(amt) + " added" });
            setAction(null);
            api.entities.StockfellAccount.update(account.id, {
              balance: account.balance + amt,
              total_contributed: account.total_contributed + amt,
              last_contribution_date: today,
            }).then(() => invalidateStokvel("StockfellAccount")).catch(() => { toast({ title: "Sync failed", variant: "destructive" }); invalidateStokvel("StockfellAccount"); });
          }} />
      )}
      {action === "withdraw" && (
        <AmountDialog title="Withdraw from Stokvel" onClose={() => setAction(null)}
          onSubmit={(amt) => {
            if (!amt || amt <= 0) return;
            if (amt > account.balance) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }
            setAccount(prev => prev ? { ...prev, balance: prev.balance - amt, total_withdrawn: prev.total_withdrawn + amt } : prev);
            toast({ title: "Withdrawn", description: fmt(amt) + " out" });
            setAction(null);
            api.entities.StockfellAccount.update(account.id, {
              balance: account.balance - amt,
              total_withdrawn: account.total_withdrawn + amt,
            }).then(() => invalidateStokvel("StockfellAccount")).catch(() => { toast({ title: "Sync failed", variant: "destructive" }); invalidateStokvel("StockfellAccount"); });
          }} />
      )}
    </div>
  );
}

function SetupForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ account_holder: "Shop Owner", target_amount: 40000, monthly_contribution: 1000, balance: 0, total_contributed: 0, total_withdrawn: 0, status: "active", members: [] });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Open stokvel</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Account holder</Label><Input value={form.account_holder} onChange={e => setForm({ ...form, account_holder: e.target.value })} /></div>
          <div><Label>Savings target (R)</Label><Input type="number" value={form.target_amount} onChange={e => setForm({ ...form, target_amount: parseFloat(e.target.value) })} /></div>
          <div><Label>Monthly contribution (R)</Label><Input type="number" value={form.monthly_contribution} onChange={e => setForm({ ...form, monthly_contribution: parseFloat(e.target.value) })} /></div>
          <div><Label>Initial deposit (R)</Label><Input type="number" value={form.balance} onChange={e => setForm({ ...form, balance: parseFloat(e.target.value), total_contributed: parseFloat(e.target.value) })} /></div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={() => onSaved(form)} className="flex-1 bg-green-600 hover:bg-green-700">Open stokvel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AmountDialog({ title, onClose, onSubmit }) {
  const [amt, setAmt] = useState("");
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xs">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input type="number" placeholder="Amount (R)" value={amt} onChange={e => setAmt(e.target.value)} className="h-12 text-lg text-center" />
          <Button onClick={() => onSubmit(parseFloat(amt))} disabled={!amt} className="w-full h-12 bg-green-600 hover:bg-green-700">Confirm</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

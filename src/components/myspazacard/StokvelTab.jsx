import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { useEntityQuery, useInvalidateEntity } from "@/hooks/useEntityQuery";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Pencil,
  PiggyBank,
  Plus,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import GroupInvites from "@/components/myspazacard/GroupInvites";
import GroupMembersDialog from "@/components/myspazacard/GroupMembersDialog";
import { useToast } from "@/components/ui/use-toast";

const fmt = (a) => "R " + Number(a || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * The shop's stokvels: a shop may run more than one, each with its own balance,
 * target, members and invitations. Owners can edit a stokvel's details, manage
 * who is in it and remove it (its open invitations go with it).
 */
export default function StokvelTab() {
  const accountsQuery = useEntityQuery("StockfellAccount", "list", []);
  const invalidate = useInvalidateEntity();
  const [accounts, setAccounts] = useState([]);
  const [dialog, setDialog] = useState(null); // { type, account }
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const loading = accountsQuery.isLoading && !accountsQuery.data;

  useEffect(() => {
    setAccounts((accountsQuery.data || []).slice().sort((a, b) => (a.created_date < b.created_date ? -1 : 1)));
  }, [accountsQuery.data]);

  const refresh = () => invalidate("StockfellAccount");

  const saveAccount = async (form, account) => {
    setSaving(true);
    try {
      if (account) {
        await api.entities.StockfellAccount.update(account.id, form);
      } else {
        await api.entities.StockfellAccount.create(form);
      }
      toast({ title: account ? "Stokvel updated" : "Stokvel opened" });
      setDialog(null);
      refresh();
    } catch (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveMembers = async (account, members) => {
    setSaving(true);
    try {
      await api.entities.StockfellAccount.update(account.id, { members });
      toast({ title: "Members updated" });
      setDialog(null);
      refresh();
    } catch (error) {
      toast({ title: "Could not save members", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const moveMoney = async (account, amount, direction) => {
    const value = Number(amount);
    if (!value || value <= 0) return;
    if (direction === "out" && value > Number(account.balance || 0)) {
      toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }
    const today = new Date().toISOString().split("T")[0];
    const patch =
      direction === "in"
        ? {
            balance: Number(account.balance || 0) + value,
            total_contributed: Number(account.total_contributed || 0) + value,
            last_contribution_date: today,
          }
        : {
            balance: Number(account.balance || 0) - value,
            total_withdrawn: Number(account.total_withdrawn || 0) + value,
          };
    setDialog(null);
    try {
      await api.entities.StockfellAccount.update(account.id, patch);
      refresh();
      toast({
        title: direction === "in" ? "Saved" : "Withdrawn",
        description: `${fmt(value)} ${direction === "in" ? "added" : "out"}`,
      });
    } catch (error) {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
      refresh();
    }
  };

  const removeAccount = async (account) => {
    try {
      await api.groups.remove("stokvel", account.id);
      setAccounts((current) => current.filter((row) => row.id !== account.id));
      toast({ title: "Stokvel removed", description: "Its open invitations were cancelled too." });
      refresh();
    } catch (error) {
      toast({ title: "Could not remove", description: error.message, variant: "destructive" });
      refresh();
    } finally {
      setDialog(null);
    }
  };

  if (loading) return <div className="text-center py-8 text-gray-400">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-gray-500">
          Save together toward stock and bulk buying. Run as many stokvels as you need.
        </p>
        <Button
          size="sm"
          onClick={() => setDialog({ type: "create", account: null })}
          className="shrink-0 bg-green-600 hover:bg-green-700"
        >
          <Plus size={16} /> New stokvel
        </Button>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-10">
          <PiggyBank size={48} className="mx-auto mb-3 text-green-200" />
          <h3 className="font-semibold text-gray-800">Open your first stokvel</h3>
          <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">
            A savings account linked to your MySpaza Card. Save toward stock and bulk buying with your
            stokvel.
          </p>
          <Button
            onClick={() => setDialog({ type: "create", account: null })}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus size={16} /> Open stokvel
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {accounts.map((account) => (
            <StokvelCard
              key={account.id}
              account={account}
              onAction={(type) => setDialog({ type, account })}
            />
          ))}
        </div>
      )}

      {dialog?.type === "create" && (
        <StokvelForm
          saving={saving}
          onClose={() => setDialog(null)}
          onSaved={(form) => saveAccount(form, null)}
        />
      )}
      {dialog?.type === "edit" && (
        <StokvelForm
          account={dialog.account}
          saving={saving}
          onClose={() => setDialog(null)}
          onSaved={(form) => saveAccount(form, dialog.account)}
        />
      )}
      {dialog?.type === "deposit" && (
        <AmountDialog
          title="Add to stokvel savings"
          onClose={() => setDialog(null)}
          onSubmit={(amount) => moveMoney(dialog.account, amount, "in")}
        />
      )}
      {dialog?.type === "withdraw" && (
        <AmountDialog
          title="Withdraw from stokvel"
          onClose={() => setDialog(null)}
          onSubmit={(amount) => moveMoney(dialog.account, amount, "out")}
        />
      )}
      {dialog?.type === "members" && (
        <GroupMembersDialog
          open
          kind="stokvel"
          members={dialog.account.members || []}
          saving={saving}
          onClose={() => setDialog(null)}
          onSave={(members) => saveMembers(dialog.account, members)}
        />
      )}
      {dialog?.type === "delete" && (
        <ConfirmDialog
          open
          onOpenChange={() => setDialog(null)}
          title={`Remove ${dialog.account.name || "this stokvel"}?`}
          description="The stokvel, its member list and any open invitations are removed. This cannot be undone."
          confirmLabel="Remove stokvel"
          onConfirm={() => removeAccount(dialog.account)}
        />
      )}
    </div>
  );
}

function StokvelCard({ account, onAction }) {
  const members = account.members || [];
  const paidCount = members.filter((member) => member.status === "paid").length;
  const progress =
    Number(account.target_amount) > 0
      ? Math.min(100, (Number(account.balance || 0) / Number(account.target_amount)) * 100)
      : 0;

  return (
    <div className="space-y-3">
      <div className="bg-gradient-to-br from-green-700 to-green-900 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-green-200 text-xs">{account.name?.trim() || "Stokvel"}</p>
            <p className="text-3xl font-bold">{fmt(account.balance)}</p>
            <p className="text-[11px] text-green-200 mt-1">
              {paidCount} of {members.length} member{members.length === 1 ? "" : "s"} paid up
            </p>
          </div>
          <PiggyBank size={40} className="text-yellow-400 shrink-0" />
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
        <Button onClick={() => onAction("deposit")} className="bg-green-600 hover:bg-green-700 h-12">
          <ArrowDownCircle size={18} /> Add to Savings
        </Button>
        <Button
          onClick={() => onAction("withdraw")}
          variant="outline"
          className="h-12 border-green-200 text-green-700"
        >
          <ArrowUpCircle size={18} /> Withdraw
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => onAction("edit")}>
          <Pencil size={14} /> Edit details
        </Button>
        <Button size="sm" variant="outline" onClick={() => onAction("members")}>
          <Users size={14} /> Manage members
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onAction("delete")}
          className="text-red-600 border-red-200 hover:text-red-700"
        >
          <Trash2 size={14} /> Remove
        </Button>
      </div>

      <div className="bg-white border rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
          <Target size={13} /> Account Details
        </p>
        <dl className="text-sm space-y-1">
          <div className="flex justify-between"><dt className="text-gray-500">Holder</dt><dd className="font-medium">{account.account_holder}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">Status</dt><dd className="font-medium capitalize">{account.status}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">Last contribution</dt><dd className="font-medium">{account.last_contribution_date || "—"}</dd></div>
        </dl>
      </div>

      <div className="bg-white border rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
          <Users size={13} /> Members
        </p>
        {members.length === 0 ? (
          <p className="text-xs text-gray-400">Only you so far — invite your friends below.</p>
        ) : (
          <div className="space-y-1">
            {members.map((member, index) => (
              <div key={index} className="flex items-center justify-between text-xs">
                <span className="truncate text-gray-700">
                  {member.name}
                  {member.email ? <span className="text-gray-400"> · {member.email}</span> : null}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-gray-500">{fmt(member.contributed)}</span>
                  {member.status === "paid" ? (
                    <Badge className="text-[9px] bg-green-100 text-green-700">paid</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px]">pending</Badge>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
        <GroupInvites
          groupKind="stokvel"
          groupId={account.id}
          groupName={account.name?.trim() || "this stokvel"}
        />
      </div>
    </div>
  );
}

function StokvelForm({ account, saving, onClose, onSaved }) {
  const [form, setForm] = useState(
    account
      ? {
          name: account.name || "",
          account_holder: account.account_holder || "Shop Owner",
          target_amount: Number(account.target_amount || 0),
          monthly_contribution: Number(account.monthly_contribution || 0),
          status: account.status || "active",
        }
      : {
          name: "",
          account_holder: "Shop Owner",
          target_amount: 40000,
          monthly_contribution: 1000,
          balance: 0,
          total_contributed: 0,
          total_withdrawn: 0,
          status: "active",
          members: [],
        }
  );
  const [deposit, setDeposit] = useState(0);

  const submit = () => {
    if (!form.name.trim()) return;
    if (account) {
      onSaved({
        name: form.name.trim(),
        account_holder: form.account_holder,
        target_amount: Number(form.target_amount) || 0,
        monthly_contribution: Number(form.monthly_contribution) || 0,
        status: form.status,
      });
      return;
    }
    const initial = Number(deposit) || 0;
    onSaved({
      ...form,
      name: form.name.trim(),
      target_amount: Number(form.target_amount) || 0,
      monthly_contribution: Number(form.monthly_contribution) || 0,
      balance: initial,
      total_contributed: initial,
    });
  };

  return (
    <Dialog open onOpenChange={saving ? undefined : onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{account ? "Edit stokvel" : "Open a new stokvel"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Stokvel name *</Label>
            <Input
              value={form.name}
              placeholder="e.g. Friday Stokvel"
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>
          <div>
            <Label>Account holder</Label>
            <Input
              value={form.account_holder}
              onChange={(event) => setForm({ ...form, account_holder: event.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Savings target (R)</Label>
              <Input
                type="number"
                value={form.target_amount}
                onChange={(event) => setForm({ ...form, target_amount: event.target.value })}
              />
            </div>
            <div>
              <Label>Monthly contribution (R)</Label>
              <Input
                type="number"
                value={form.monthly_contribution}
                onChange={(event) => setForm({ ...form, monthly_contribution: event.target.value })}
              />
            </div>
          </div>
          {!account && (
            <div>
              <Label>Initial deposit (R)</Label>
              <Input type="number" value={deposit} onChange={(event) => setDeposit(event.target.value)} />
            </div>
          )}
          {account && (
            <div>
              <Label>Status</Label>
              <Input
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
                placeholder="active"
              />
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={saving || !form.name.trim()}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {saving ? "Saving..." : account ? "Save changes" : "Open stokvel"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AmountDialog({ title, onClose, onSubmit }) {
  const [amount, setAmount] = useState("");
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xs">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input
            type="number"
            placeholder="Amount (R)"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="h-12 text-lg text-center"
          />
          <Button
            onClick={() => onSubmit(amount)}
            disabled={!amount}
            className="w-full h-12 bg-green-600 hover:bg-green-700"
          >
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

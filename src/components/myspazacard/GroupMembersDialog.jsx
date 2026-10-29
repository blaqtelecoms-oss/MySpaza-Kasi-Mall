import { useEffect, useState } from "react";
import { Check, Plus, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const fmt = (a) => "R " + Number(a || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MEMBER_DEFAULTS = {
  stokvel: { contributed: 0, status: "pending" },
  savings_group: { contributed: 0, status: "pending" },
  bulk_buy: { quantity: 0, amount: 0, paid: false },
};

/**
 * Owner's member list for one group: add someone by hand, change what they have
 * put in (or how much stock they are taking), mark it paid, or remove them.
 * Invitations by email stay in GroupInvites; this is the manual admin.
 */
export default function GroupMembersDialog({ open, onClose, kind, unit, members, onSave, saving }) {
  const [rows, setRows] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!open) return;
    setRows((members || []).map((member) => ({ ...member })));
    setName("");
    setEmail("");
  }, [open, members]);

  const isBulk = kind === "bulk_buy";

  const update = (index, patch) => {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const row = {
      name: trimmed,
      email: email.trim().toLowerCase() || undefined,
      ...(MEMBER_DEFAULTS[kind] || MEMBER_DEFAULTS.stokvel),
    };
    setRows((current) => [...current, row]);
    setName("");
    setEmail("");
  };

  const remove = (index) => setRows((current) => current.filter((_, i) => i !== index));

  const save = () => {
    const clean = rows
      .filter((row) => String(row.name || "").trim())
      .map((row) => ({
        name: String(row.name).trim(),
        ...(row.email ? { email: String(row.email).trim().toLowerCase() } : {}),
        ...(isBulk
          ? {
              quantity: Number(row.quantity) || 0,
              amount: Number(row.amount) || 0,
              paid: Boolean(row.paid),
            }
          : {
              contributed: Number(row.contributed) || 0,
              status: row.status === "paid" ? "paid" : "pending",
            }),
      }));
    onSave(clean);
  };

  return (
    <Dialog open={open} onOpenChange={saving ? undefined : onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage members</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {rows.length === 0 ? (
            <p className="text-xs text-gray-400">No members yet. Add one below or invite by email.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((row, index) => (
                <div key={index} className="rounded-xl border border-slate-200 p-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-8 text-sm"
                      value={row.name || ""}
                      onChange={(event) => update(index, { name: event.target.value })}
                      placeholder="Member name"
                    />
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Remove ${row.name || "member"}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      className="h-8 text-xs"
                      type="email"
                      inputMode="email"
                      value={row.email || ""}
                      onChange={(event) => update(index, { email: event.target.value })}
                      placeholder="Email (optional)"
                    />
                    {isBulk ? (
                      <>
                        <Input
                          className="h-8 w-20 text-xs"
                          type="number"
                          value={row.quantity ?? 0}
                          onChange={(event) => update(index, { quantity: event.target.value })}
                          aria-label={`Quantity for ${row.name || "member"}`}
                        />
                        <Input
                          className="h-8 w-24 text-xs"
                          type="number"
                          value={row.amount ?? 0}
                          onChange={(event) => update(index, { amount: event.target.value })}
                          aria-label={`Amount for ${row.name || "member"}`}
                        />
                      </>
                    ) : (
                      <Input
                        className="h-8 w-24 text-xs"
                        type="number"
                        value={row.contributed ?? 0}
                        onChange={(event) => update(index, { contributed: event.target.value })}
                        aria-label={`Amount contributed by ${row.name || "member"}`}
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    {isBulk ? (
                      <span className="text-[11px] text-gray-500">
                        {row.quantity || 0} {unit || "units"} · {fmt(row.amount)}
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-500">{fmt(row.contributed)} contributed</span>
                    )}

                    {isBulk ? (
                      <button
                        type="button"
                        onClick={() => update(index, { paid: !row.paid })}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          row.paid ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {row.paid ? "paid" : "unpaid"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => update(index, { status: row.status === "paid" ? "pending" : "paid" })}
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          row.status === "paid" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {row.status === "paid" ? <Check size={10} /> : null}
                        {row.status === "paid" ? "paid" : "pending"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-dashed border-slate-300 p-2.5 space-y-2">
            <Label className="text-xs">Add a member</Label>
            <div className="flex gap-2">
              <Input
                className="h-8 text-sm"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Name"
                onKeyDown={(event) => event.key === "Enter" && add()}
              />
              <Input
                className="h-8 text-sm"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email (optional)"
                onKeyDown={(event) => event.key === "Enter" && add()}
              />
              <Button type="button" size="sm" onClick={add} disabled={!name.trim()} className="shrink-0">
                <Plus size={15} />
              </Button>
            </div>
            <p className="flex items-center gap-1 text-[11px] text-gray-400">
              <UserPlus size={12} /> To email an invitation link, use Invite on the group card.
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save members"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Small paid/pending chip reused by the group cards. */
export function MemberStatus({ paid }) {
  return paid ? (
    <Badge className="text-[9px] bg-green-100 text-green-700">paid</Badge>
  ) : (
    <Badge variant="outline" className="text-[9px]">pending</Badge>
  );
}

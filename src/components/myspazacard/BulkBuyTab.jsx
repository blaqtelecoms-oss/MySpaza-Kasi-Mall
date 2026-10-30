import { useState } from "react";
import { api } from "@/api/client";
import { useEntityQuery, useInvalidateEntity } from "@/hooks/useEntityQuery";
import { Plus, Boxes, Trash2, UserPlus, Check, Package, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MobileSelect } from "@/components/ui/mobile-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import GroupInvites from "@/components/myspazacard/GroupInvites";
import ConfirmDialog from "@/components/ConfirmDialog";

const fmt = (a) => "R " + Number(a || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_COLOR = {
  open: "bg-blue-100 text-blue-700",
  filled: "bg-yellow-100 text-yellow-700",
  ordered: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  distributed: "bg-green-200 text-green-800",
  cancelled: "bg-red-100 text-red-700",
};

export default function BulkBuyTab() {
  const ordersQuery = useEntityQuery("BulkBuy", "list", []);
  const wholesalersQuery = useEntityQuery("Wholesaler", "list", []);
  const orders = ordersQuery.data || [];
  const wholesalers = wholesalersQuery.data || [];
  const loading = ordersQuery.isLoading && !ordersQuery.data;
  const invalidate = useInvalidateEntity();
  const [modal, setModal] = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  const [joinOrder, setJoinOrder] = useState(null);
  const [confirmOrder, setConfirmOrder] = useState(null);
  const { toast } = useToast();

  const load = () => { invalidate("BulkBuy"); invalidate("Wholesaler"); };

  const removeOrder = async (order) => {
    try {
      await api.groups.remove("bulk_buy", order.id);
      toast({ title: "Bulk buy removed", description: "Its open invitations were cancelled too." });
    } catch (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } finally {
      setConfirmOrder(null);
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Buy in bulk from a wholesaler with other shop owners and share the stock.</p>
        <Button size="sm" onClick={() => setModal(true)} className="bg-green-600 hover:bg-green-700"><Plus size={16} /> New Bulk Buy</Button>
      </div>

      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : orders.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Boxes size={40} className="mx-auto mb-2 opacity-40" />
          <p>No bulk buy orders yet. Start one and invite other shop owners to split the stock.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(o => (
            <div key={o.id} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center"><Package size={20} className="text-green-700" /></div>
                  <div>
                    <p className="font-semibold text-gray-800">{o.title}</p>
                    <p className="text-xs text-gray-500">{o.wholesaler_name}</p>
                  </div>
                </div>
                <Badge className={`text-[10px] ${STATUS_COLOR[o.status] || ""}`}>{o.status}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-[10px] text-gray-500">Total Quantity</p>
                  <p className="font-semibold">{o.total_quantity} {o.unit}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-[10px] text-gray-500">Unit Cost</p>
                  <p className="font-semibold">{fmt(o.unit_cost)}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <p className="text-[10px] text-gray-500">Total Cost</p>
                  <p className="font-semibold text-green-700">{fmt(o.total_cost)}</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-2">
                  <p className="text-[10px] text-gray-500">Per Member</p>
                  <p className="font-semibold text-yellow-700">{fmt(o.per_member_cost)} · {o.per_member_quantity} {o.unit}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-600">{o.member_count} / {o.max_members || "∞"} members</span>
                <div className="flex items-center gap-1">
                  {o.invited ? (
                    <Badge variant="outline" className="text-[10px]">member</Badge>
                  ) : (
                    <>
                      {o.status === "open" && (
                        <Button size="sm" variant="outline" className="text-green-700 border-green-200 h-8" onClick={() => setJoinOrder(o)}>
                          <UserPlus size={14} /> Join
                        </Button>
                      )}
                      <button
                        onClick={() => { setEditOrder(o); setModal(true); }}
                        aria-label={`Edit ${o.title}`}
                      >
                        <Pencil size={15} className="text-gray-400 hover:text-gray-600" />
                      </button>
                      <button onClick={() => setConfirmOrder(o)} aria-label={`Remove ${o.title}`}>
                        <Trash2 size={15} className="text-red-400 hover:text-red-600" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {o.members && o.members.length > 0 && (
                <div className="mt-3 border-t pt-2">
                  <p className="text-[11px] font-semibold text-gray-500 mb-1">Sharing</p>
                  <div className="space-y-1">
                    {o.members.map((m, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700">{m.name} · {m.quantity} {o.unit}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-gray-500">{fmt(m.amount)}</span>
                          {m.paid ? <Check size={12} className="text-green-600" /> : <Badge variant="outline" className="text-[9px]">unpaid</Badge>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!o.invited && <GroupInvites groupKind="bulk_buy" groupId={o.id} groupName={o.title} />}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <BulkBuyForm
          wholesalers={wholesalers}
          edit={editOrder}
          onClose={() => { setModal(false); setEditOrder(null); }}
          onSaved={() => { setModal(false); setEditOrder(null); load(); }}
        />
      )}
      {joinOrder && <JoinDialog order={joinOrder} onClose={() => setJoinOrder(null)} onSaved={() => { setJoinOrder(null); load(); }} />}
      {confirmOrder && (
        <ConfirmDialog
          open
          onOpenChange={() => setConfirmOrder(null)}
          title={`Remove "${confirmOrder.title}"?`}
          description="The bulk buy, its member shares and any open invitations are removed. This cannot be undone."
          confirmLabel="Remove bulk buy"
          onConfirm={() => removeOrder(confirmOrder)}
        />
      )}
    </div>
  );
}

function BulkBuyForm({ wholesalers, edit, onClose, onSaved }) {
  const [form, setForm] = useState(edit ? {
    title: edit.title || "", product_name: edit.product_name || "",
    wholesaler_id: edit.wholesaler_id || "", wholesaler_name: edit.wholesaler_name || "",
    total_quantity: Number(edit.total_quantity || 0), unit: edit.unit || "bags",
    unit_cost: Number(edit.unit_cost || 0), max_members: Number(edit.max_members || 5),
    created_by_name: edit.created_by_name || "Shop Owner", status: edit.status || "open",
    members: edit.members || [], notes: edit.notes || "",
  } : {
    title: "", product_name: "", wholesaler_id: wholesalers[0]?.id || "", wholesaler_name: wholesalers[0]?.name || "",
    total_quantity: 50, unit: "bags", unit_cost: 0, max_members: 5, created_by_name: "Shop Owner",
    status: "open", members: [{ name: "Shop Owner", quantity: 0, amount: 0, paid: false }], notes: "",
  });
  const [newMember, setNewMember] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const total_cost = form.total_quantity * form.unit_cost;
  const memberCount = form.members.length || 1;
  const per_member_cost = total_cost / memberCount;
  const per_member_quantity = form.total_quantity / memberCount;

  const addMember = () => {
    if (!newMember) return;
    setForm({ ...form, members: [...form.members, { name: newMember, quantity: 0, amount: 0, paid: false }] });
    setNewMember("");
  };

  const submit = async () => {
    if (!form.title || !form.product_name || form.unit_cost <= 0) {
      toast({ title: "Fill in title, product and unit cost", variant: "destructive" }); return;
    }
    setSaving(true);
    const payload = {
      ...form, total_cost, member_count: memberCount, per_member_cost: Math.round(per_member_cost * 100) / 100,
      per_member_quantity: Math.round(per_member_quantity * 100) / 100,
      order_date: edit?.order_date || new Date().toISOString().split("T")[0],
    };
    try {
      if (edit) {
        await api.entities.BulkBuy.update(edit.id, payload);
        toast({ title: "Bulk buy updated" });
      } else {
        await api.entities.BulkBuy.create(payload);
        toast({ title: "Bulk buy created", description: "Other shop owners can now join." });
      }
      onSaved();
    } catch (e) {
      toast({ title: "Error", description: e.message || "Could not save", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{edit ? "Edit Bulk Buy Order" : "New Bulk Buy Order"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input placeholder="e.g. Bulk Maize Meal - 50 bags" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Product</Label><Input value={form.product_name} onChange={e => setForm({ ...form, product_name: e.target.value })} /></div>
          <div><Label>Wholesaler</Label>
            <MobileSelect
              value={form.wholesaler_id}
              onValueChange={v => {
                const w = wholesalers.find(x => x.id === v);
                setForm({ ...form, wholesaler_id: v, wholesaler_name: w?.name });
              }}
              placeholder="Wholesaler"
              options={wholesalers.map(w => ({ value: w.id, label: w.name }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Qty</Label><Input type="number" value={form.total_quantity} onChange={e => setForm({ ...form, total_quantity: parseFloat(e.target.value) })} /></div>
            <div><Label>Unit</Label><Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} /></div>
            <div><Label>Unit cost</Label><Input type="number" value={form.unit_cost} onChange={e => setForm({ ...form, unit_cost: parseFloat(e.target.value) })} /></div>
          </div>
          <div><Label>Max members</Label><Input type="number" value={form.max_members} onChange={e => setForm({ ...form, max_members: parseInt(e.target.value) })} /></div>

          <div className="bg-green-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-600">Total cost</span><span className="font-semibold">{fmt(total_cost)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Per member ({memberCount})</span><span className="font-semibold text-green-700">{fmt(per_member_cost)} · {per_member_quantity.toFixed(1)} {form.unit}</span></div>
          </div>

          <div>
            <Label>Members</Label>
            <div className="flex gap-2">
              <Input placeholder="Shop owner name" value={newMember} onChange={e => setNewMember(e.target.value)} />
              <Button type="button" size="sm" onClick={addMember}><UserPlus size={15} /></Button>
            </div>
            <div className="mt-2 space-y-1">
              {form.members.map((m, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded px-2 py-1">
                  <span>{m.name}</span>
                  <button onClick={() => setForm({ ...form, members: form.members.filter((_, j) => j !== i) })}>
                    <Trash2 size={13} className="text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={submit} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700">{saving ? "Saving..." : edit ? "Save Changes" : "Create Bulk Buy"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function JoinDialog({ order, onClose, onSaved }) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const { toast } = useToast();

  const unitCost = order.unit_cost;
  const amount = (parseFloat(quantity) || 0) * unitCost;

  const join = async () => {
    if (!name || !quantity) { toast({ title: "Enter name and quantity", variant: "destructive" }); return; }
    const members = [...(order.members || []), { name, quantity: parseFloat(quantity), amount, paid: false }];
    const memberCount = members.length;
    const totalCost = order.total_cost;
    await api.entities.BulkBuy.update(order.id, {
      members, member_count: memberCount,
      per_member_cost: Math.round((totalCost / memberCount) * 100) / 100,
      per_member_quantity: Math.round((order.total_quantity / memberCount) * 100) / 100,
      status: memberCount >= (order.max_members || Infinity) ? "filled" : order.status,
    });
    toast({ title: "Joined bulk buy", description: `${quantity} ${order.unit} for ${fmt(amount)}` });
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xs">
        <DialogHeader><DialogTitle>Join "{order.title}"</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Your name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Quantity ({order.unit})</Label><Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} /></div>
          <div className="bg-gray-50 rounded-lg p-2 text-sm flex justify-between"><span className="text-gray-600">Your cost ({fmt(unitCost)}/{order.unit})</span><span className="font-semibold">{fmt(amount)}</span></div>
          <Button onClick={join} className="w-full bg-green-600 hover:bg-green-700">Join & Share Stock</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
import { useState } from "react";
import { api } from "@/api/client";
import { useEntityQuery, useInvalidateEntity } from "@/hooks/useEntityQuery";
import { Plus, Trash2, Pencil, Store, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MobileSelect } from "@/components/ui/mobile-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

const fmt = (a) => "R " + Number(a || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CATEGORIES = ["Wholesale", "Hardware", "Cash & Carry", "Grocery", "Other"];

export default function DiscountsTab() {
  const wholesalersQuery = useEntityQuery("Wholesaler", "list", []);
  const discountsQuery = useEntityQuery("WholesalerDiscount", "list", []);
  const wholesalers = wholesalersQuery.data || [];
  const discounts = discountsQuery.data || [];
  const loading = wholesalersQuery.isLoading && !wholesalersQuery.data;
  const invalidate = useInvalidateEntity();
  const [wsModal, setWsModal] = useState(false);
  const [discModal, setDiscModal] = useState(null); // null | { wholesaler } | { edit: record }
  const { toast } = useToast();

  const load = () => { invalidate("Wholesaler"); invalidate("WholesalerDiscount"); };

  const discountsFor = (wsId) => discounts.filter(d => d.wholesaler_id === wsId).sort((a, b) => a.min_purchase_amount - b.min_purchase_amount);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Wholesalers offering card discounts. Set discount tiers based on purchase amount.</p>
        <Button size="sm" onClick={() => setWsModal(true)} className="bg-green-600 hover:bg-green-700">
          <Plus size={16} /> Add Wholesaler
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : wholesalers.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Store size={40} className="mx-auto mb-2 opacity-40" />
          <p>No participating wholesalers yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {wholesalers.map(ws => (
            <div key={ws.id} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <Store size={20} className="text-green-700" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{ws.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-[10px]">{ws.category}</Badge>
                      {ws.card_accepted && <Badge className="bg-yellow-100 text-yellow-800 text-[10px]">Card Accepted</Badge>}
                    </div>
                  </div>
                </div>
                <button onClick={async () => {
                  await api.entities.Wholesaler.delete(ws.id);
                  load();
                }}><Trash2 size={16} className="text-red-400 hover:text-red-600" /></button>
              </div>

              <div className="mt-3 border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-600 flex items-center gap-1"><Tag size={13} /> Discount Tiers</p>
                  <button
                    onClick={() => setDiscModal({ wholesaler: ws })}
                    className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                  >
                    <Plus size={13} /> Add Tier
                  </button>
                </div>
                {discountsFor(ws.id).length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No discount tiers set. Add one to give card holders a discount.</p>
                ) : (
                  <div className="space-y-1.5">
                    {discountsFor(ws.id).map(d => (
                      <div key={d.id} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2">
                        <div>
                          <span className="text-sm font-semibold text-green-700">{d.discount_percentage}% off</span>
                          <span className="text-xs text-gray-500"> on purchases over {fmt(d.min_purchase_amount)}</span>
                          {d.tier_name && <Badge variant="outline" className="ml-2 text-[10px]">{d.tier_name}</Badge>}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setDiscModal({ edit: d })}><Pencil size={13} className="text-gray-400 hover:text-gray-600" /></button>
                          <button onClick={async () => { await api.entities.WholesalerDiscount.delete(d.id); load(); }}>
                            <Trash2 size={13} className="text-red-400 hover:text-red-600" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {wsModal && <WholesalerForm onClose={() => setWsModal(false)} onSaved={() => { setWsModal(false); load(); }} />}
      {discModal && <DiscountForm
        mode={discModal}
        wholesalers={wholesalers}
        onClose={() => setDiscModal(null)}
        onSaved={() => { setDiscModal(null); load(); }}
      />}
    </div>
  );
}

function WholesalerForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", category: "Wholesale", phone: "", email: "", address: "", notes: "", card_accepted: true });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const submit = async () => {
    if (!form.name) { toast({ title: "Name required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await api.entities.Wholesaler.create({ ...form, is_participating: true });
      toast({ title: "Wholesaler added", description: "Now add discount tiers." });
      onSaved();
    } catch (e) {
      toast({ title: "Error", description: "Could not save", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Participating Wholesaler</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Category</Label>
            <MobileSelect
              value={form.category}
              onValueChange={v => setForm({ ...form, category: v })}
              placeholder="Category"
              options={CATEGORIES.map(c => ({ value: c, label: c }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
          <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.card_accepted} onChange={e => setForm({ ...form, card_accepted: e.target.checked })} /> Card accepted at this wholesaler</label>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={submit} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700">{saving ? "Saving..." : "Add Wholesaler"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DiscountForm({ mode, wholesalers, onClose, onSaved }) {
  const editing = !!mode.edit;
  const ws = mode.wholesaler || mode.edit?.wholesaler_id || wholesalers[0];
  const [form, setForm] = useState(editing ? {
    wholesaler_id: mode.edit.wholesaler_id,
    wholesaler_name: mode.edit.wholesaler_name,
    tier_name: mode.edit.tier_name || "",
    min_purchase_amount: mode.edit.min_purchase_amount,
    discount_percentage: mode.edit.discount_percentage,
    description: mode.edit.description || "",
    is_active: mode.edit.is_active ?? true,
  } : {
    wholesaler_id: ws.id,
    wholesaler_name: ws.name,
    tier_name: "",
    min_purchase_amount: 0,
    discount_percentage: 0,
    description: "",
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const submit = async () => {
    if (form.min_purchase_amount <= 0 || form.discount_percentage <= 0) {
      toast({ title: "Enter amount and percentage", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.entities.WholesalerDiscount.update(mode.edit.id, form);
      } else {
        await api.entities.WholesalerDiscount.create(form);
      }
      toast({ title: editing ? "Tier updated" : "Discount tier added" });
      onSaved();
    } catch (e) {
      toast({ title: "Error", description: "Could not save", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? "Edit Discount Tier" : "Add Discount Tier"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
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
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Tier name</Label><Input placeholder="e.g. Silver, Gold" value={form.tier_name} onChange={e => setForm({ ...form, tier_name: e.target.value })} /></div>
            <div><Label>Min purchase (R)</Label><Input type="number" value={form.min_purchase_amount} onChange={e => setForm({ ...form, min_purchase_amount: parseFloat(e.target.value) })} /></div>
          </div>
          <div><Label>Discount %</Label><Input type="number" step="0.5" value={form.discount_percentage} onChange={e => setForm({ ...form, discount_percentage: parseFloat(e.target.value) })} /></div>
          <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={submit} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700">{saving ? "Saving..." : "Save Tier"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
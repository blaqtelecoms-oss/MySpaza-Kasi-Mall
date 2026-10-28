import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useEntityQuery, useInvalidateEntity } from "@/hooks/useEntityQuery";
import QueryRefreshIndicator from "@/components/QueryRefreshIndicator";
import { Plus, Phone, Mail, Edit, Trash2, Truck, RefreshCw, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/ui/use-toast";
import DevlandCatalog from "@/components/suppliers/DevlandCatalog";

const formatCurrency = (n) => `R ${(n || 0).toFixed(2)}`;
const empty = { name: "", contact_person: "", phone: "", email: "", address: "", account_number: "", credit_terms: "", outstanding_balance: "", notes: "", is_active: true };

export default function Suppliers() {
  const suppliersQuery = useEntityQuery("Supplier", "list", []);
  const suppliers = suppliersQuery.data || [];
  const loading = suppliersQuery.isLoading && !suppliersQuery.data;
  const invalidateSupplier = useInvalidateEntity();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const { toast } = useToast();

  const openNew = () => { setEditItem(null); setForm(empty); setModalOpen(true); };
  const openEdit = (s) => { setEditItem(s); setForm({...s}); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.name) { toast({ title: "Name required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const data = { ...form, credit_terms: parseInt(form.credit_terms) || 0, outstanding_balance: parseFloat(form.outstanding_balance) || 0 };
      if (editItem) {
        await base44.entities.Supplier.update(editItem.id, data);
        toast({ title: "Supplier Updated" });
      } else {
        await base44.entities.Supplier.create(data);
        toast({ title: "Supplier Added" });
      }
      setModalOpen(false);
      invalidateSupplier("Supplier");
    } catch (err) {
      toast({ title: "Error", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = (s) => setDeleteTarget(s);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await base44.entities.Supplier.delete(deleteTarget.id);
    setDeleteTarget(null);
    invalidateSupplier("Supplier");
  };

  const filtered = suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  const totalOwed = suppliers.reduce((sum, s) => sum + (s.outstanding_balance || 0), 0);

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Suppliers</h1>
            <QueryRefreshIndicator isFetching={suppliersQuery.isFetching} hasData={suppliers.length > 0} />
          </div>
          <p className="text-muted-foreground text-sm">Total outstanding: <span className="text-red-600 dark:text-red-400 font-semibold">{formatCurrency(totalOwed)}</span></p>
        </div>
        <Button onClick={openNew} className="bg-green-600 hover:bg-green-700 gap-2"><Plus size={18} /> Add Supplier</Button>
      </div>

      {/* Devland Wholesale Banner */}
      <div className="flex items-center gap-3 bg-gradient-to-r from-[#0D0D0D] to-[#1c1c1c] rounded-2xl p-4 text-white">
        <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
          <Truck size={24} className="text-foreground" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm">Devland Cash & Carry</p>
          <p className="text-xs text-white/60">Springs & Devland · 065 315 4291 · Browse catalog & add items to your stock</p>
        </div>
        <Button
          size="sm"
          className="bg-[#FFD426] text-[#0D0D0D] hover:bg-yellow-400 gap-1.5 flex-shrink-0"
          onClick={() => setCatalogOpen(true)}
        >
          <BookOpen size={15} /> View Catalog
        </Button>
      </div>

      <Input placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} />

      {loading ? (
        <div className="text-center py-8"><RefreshCw className="animate-spin mx-auto text-muted-foreground" size={28} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-2xl border border-border">
          <Truck size={48} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No suppliers added yet</p>
          <Button onClick={openNew} className="mt-3 bg-green-600 hover:bg-green-700">Add Supplier</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(s => (
            <Card key={s.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center">
                      <Truck size={22} className="text-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-foreground">{s.name}</h3>
                        {s.name?.toLowerCase().includes("devland") && (
                          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 text-[10px]">Wholesaler</Badge>
                        )}
                      </div>
                      {s.contact_person && <p className="text-sm text-muted-foreground">{s.contact_person}</p>}
                      <div className="flex flex-wrap gap-3 mt-1">
                        {s.phone && (
                          <a href={`tel:${s.phone}`} className="flex items-center gap-1 text-xs text-foreground">
                            <Phone size={12} /> {s.phone}
                          </a>
                        )}
                        {s.email && (
                          <a href={`mailto:${s.email}`} className="flex items-center gap-1 text-xs text-foreground">
                            <Mail size={12} /> {s.email}
                          </a>
                        )}
                      </div>
                      {s.name?.toLowerCase().includes("devland") && (
                        <button
                          className="mt-1.5 flex items-center gap-1 text-xs text-foreground font-medium"
                          onClick={(e) => { e.stopPropagation(); setCatalogOpen(true); }}
                        >
                          <BookOpen size={12} /> View Digital Catalog
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    {(s.outstanding_balance || 0) > 0 && (
                      <Badge className="bg-red-100 text-red-700 mb-2 block">{formatCurrency(s.outstanding_balance)} owed</Badge>
                    )}
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-11 w-11" onClick={() => openEdit(s)}>
                        <Edit size={18} className="text-foreground" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-11 w-11" onClick={() => handleDelete(s)}>
                        <Trash2 size={15} className="text-red-400" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editItem ? "Edit Supplier" : "Add Supplier"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {[["name","Business Name *"], ["contact_person","Contact Person"], ["phone","Phone"], ["email","Email"], ["address","Address"], ["account_number","Account Number"]].map(([field, label]) => (
              <div key={field}>
                <Label>{label}</Label>
                <Input className="mt-1" value={form[field]} onChange={e => setForm({...form, [field]: e.target.value})} />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Credit Days</Label>
                <Input className="mt-1" type="number" value={form.credit_terms} onChange={e => setForm({...form, credit_terms: e.target.value})} />
              </div>
              <div>
                <Label>Outstanding Balance (R)</Label>
                <Input className="mt-1" type="number" value={form.outstanding_balance} onChange={e => setForm({...form, outstanding_balance: e.target.value})} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Input className="mt-1" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
            </div>
          </div>
          <div className="flex gap-2 pt-3">
            <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700">
              {saving ? "Saving..." : editItem ? "Update" : "Add Supplier"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Supplier"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
      />

      <DevlandCatalog open={catalogOpen} onClose={() => setCatalogOpen(false)} />
    </div>
  );
}
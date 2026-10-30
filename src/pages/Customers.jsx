import { useState } from "react";
import { api } from "@/api/client";
import { useEntityQuery, useInvalidateEntity } from "@/hooks/useEntityQuery";
import QueryRefreshIndicator from "@/components/QueryRefreshIndicator";
import { Plus, Phone, Edit, Trash2, Users, Star, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/ui/use-toast";

const formatCurrency = (n) => `R ${(n || 0).toFixed(2)}`;
const empty = { name: "", phone: "", email: "", address: "", loyalty_points: 0, credit_limit: "", outstanding_balance: "", notes: "", is_active: true };

export default function Customers() {
  const customersQuery = useEntityQuery("Customer", "list", []);
  const customers = customersQuery.data || [];
  const loading = customersQuery.isLoading && !customersQuery.data;
  const invalidateCustomer = useInvalidateEntity();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { toast } = useToast();

  const openNew = () => { setEditItem(null); setForm(empty); setModalOpen(true); };
  const openEdit = (c) => { setEditItem(c); setForm({...c}); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.name) { toast({ title: "Name required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const data = { ...form, credit_limit: parseFloat(form.credit_limit) || 0, outstanding_balance: parseFloat(form.outstanding_balance) || 0 };
      if (editItem) {
        await api.entities.Customer.update(editItem.id, data);
        toast({ title: "Customer Updated" });
      } else {
        await api.entities.Customer.create(data);
        toast({ title: "Customer Added" });
      }
      setModalOpen(false);
      invalidateCustomer("Customer");
    } catch { toast({ title: "Error", variant: "destructive" }); }
    setSaving(false);
  };

  const handleDelete = (c) => setDeleteTarget(c);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await api.entities.Customer.delete(deleteTarget.id);
    setDeleteTarget(null);
    invalidateCustomer("Customer");
  };

  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">Customers</h1>
            <QueryRefreshIndicator isFetching={customersQuery.isFetching} hasData={customers.length > 0} />
          </div>
          <p className="text-sm text-muted-foreground">{customers.length} registered customers</p>
        </div>
        <Button onClick={openNew} className="gap-2 bg-green-600 hover:bg-green-700"><Plus size={16} /> Add Customer</Button>
      </div>

      <Input placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} />

      {loading ? (
        <div className="text-center py-8"><RefreshCw className="animate-spin mx-auto text-muted-foreground" size={28} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-2xl border border-border">
          <Users size={48} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No customers yet</p>
          <Button onClick={openNew} className="mt-3 bg-green-600 hover:bg-green-700">Add Customer</Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map(c => (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                      <span className="text-foreground font-bold text-lg">{c.name[0]?.toUpperCase()}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">{c.name}</h3>
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-sm text-foreground">
                          <Phone size={12} /> {c.phone}
                        </a>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className="bg-yellow-100 text-yellow-700 text-xs">
                          <Star size={10} className="mr-1" /> {c.loyalty_points || 0} pts
                        </Badge>
                        {(c.outstanding_balance || 0) > 0 && (
                          <Badge className="bg-red-100 text-red-700 text-xs">{formatCurrency(c.outstanding_balance)} owed</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-11 w-11" onClick={() => openEdit(c)}>
                      <Edit size={18} className="text-foreground" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-11 w-11" onClick={() => handleDelete(c)}>
                      <Trash2 size={15} className="text-red-400" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editItem ? "Edit Customer" : "Add Customer"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {[["name","Full Name *"], ["phone","Phone Number"], ["email","Email"], ["address","Address"]].map(([field, label]) => (
              <div key={field}>
                <Label>{label}</Label>
                <Input className="mt-1" value={form[field]} onChange={e => setForm({...form, [field]: e.target.value})} />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Credit Limit (R)</Label>
                <Input className="mt-1" type="number" value={form.credit_limit} onChange={e => setForm({...form, credit_limit: e.target.value})} />
              </div>
              <div>
                <Label>Outstanding (R)</Label>
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
              {saving ? "Saving..." : editItem ? "Update" : "Add Customer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Customer"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
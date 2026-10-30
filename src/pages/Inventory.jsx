import { useState } from "react";
import { api } from "@/api/client";
import { useEntityQuery, useInvalidateEntity } from "@/hooks/useEntityQuery";
import QueryRefreshIndicator from "@/components/QueryRefreshIndicator";
import {
  Plus, MagnifyingGlass, PencilSimple, Trash, Package, Warning, ArrowsClockwise,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MobileSelect } from "@/components/ui/mobile-select";
import { useToast } from "@/components/ui/use-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import AdBanner from "@/components/AdBanner";
import ProductImageUpload from "@/components/inventory/ProductImageUpload";

const formatCurrency = (n) => `R ${(n || 0).toFixed(2)}`;

const CATEGORIES = ["Food & Groceries", "Drinks & Beverages", "Tobacco", "Airtime & Data", "Household", "Personal Care", "Snacks & Sweets", "Bread & Bakery", "Dairy", "Other"];

const emptyProduct = {
  name: "", barcode: "", category: "", description: "",
  cost_price: "", selling_price: "", stock_quantity: "",
  min_stock_level: "", max_stock_level: "", unit: "each",
  vat_applicable: false, is_active: true, notes: ""
};

export default function Inventory() {
  const productsQuery = useEntityQuery("Product", "list", []);
  const products = productsQuery.data || [];
  const loading = productsQuery.isLoading && !productsQuery.data;
  const invalidateProduct = useInvalidateEntity();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStock, setFilterStock] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { toast } = useToast();

  const openNew = () => {
    setEditProduct(null);
    setForm(emptyProduct);
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditProduct(p);
    setForm({ ...p });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.selling_price) {
      toast({ title: "Required Fields", description: "Name and selling price are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const data = {
        ...form,
        cost_price: parseFloat(form.cost_price) || 0,
        selling_price: parseFloat(form.selling_price) || 0,
        stock_quantity: parseFloat(form.stock_quantity) || 0,
        min_stock_level: parseFloat(form.min_stock_level) || 0,
        max_stock_level: parseFloat(form.max_stock_level) || 0,
      };
      if (editProduct) {
        await api.entities.Product.update(editProduct.id, data);
        toast({ title: "Product Updated", description: `${form.name} has been updated` });
      } else {
        await api.entities.Product.create(data);
        toast({ title: "Product Added", description: `${form.name} has been added` });
      }
      setModalOpen(false);
      invalidateProduct("Product");
    } catch (err) {
      toast({ title: "Error", description: "Failed to save product", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = (product) => setDeleteTarget(product);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await api.entities.Product.delete(deleteTarget.id);
    toast({ title: "Deleted", description: `${deleteTarget.name} removed` });
    setDeleteTarget(null);
    invalidateProduct("Product");
  };

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.includes(search));
    const matchCat = filterCategory === "all" || p.category === filterCategory;
    const matchStock = filterStock === "all" ||
      (filterStock === "low" && p.stock_quantity <= (p.min_stock_level || 5)) ||
      (filterStock === "out" && p.stock_quantity === 0) ||
      (filterStock === "ok" && p.stock_quantity > (p.min_stock_level || 5));
    return matchSearch && matchCat && matchStock;
  });

  const totalValue = products.reduce((sum, p) => sum + ((p.cost_price || 0) * (p.stock_quantity || 0)), 0);
  const lowStockCount = products.filter(p => p.stock_quantity <= (p.min_stock_level || 5)).length;

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">Inventory</h1>
            <QueryRefreshIndicator isFetching={productsQuery.isFetching} hasData={products.length > 0} />
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {products.length} products · Stock value: {formatCurrency(totalValue)}
          </p>
        </div>
        <Button onClick={openNew} className="gap-2 bg-green-600 hover:bg-green-700">
          <Plus size={16} weight="bold" /> Add Product
        </Button>
      </div>

      {/* Ad Banner */}
      <AdBanner placement="inventory" />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="bg-muted/50 border-border">
          <CardContent className="p-2.5 text-center sm:p-3">
            <Package size={18} weight="duotone" className="mx-auto mb-1 text-slate-500" />
            <p className="text-lg font-bold leading-tight text-foreground sm:text-2xl">{products.length}</p>
            <p className="text-[11px] leading-tight text-muted-foreground sm:text-xs">Total Products</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800">
          <CardContent className="p-2.5 text-center sm:p-3">
            <Warning size={18} weight="duotone" className="mx-auto mb-1 text-red-600" />
            <p className="text-lg font-bold leading-tight text-red-700 dark:text-red-400 sm:text-2xl">{lowStockCount}</p>
            <p className="text-[11px] leading-tight text-red-600 dark:text-red-400/80 sm:text-xs">Low Stock</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/50 border-border">
          <CardContent className="p-2.5 text-center sm:p-3">
            <Package size={18} weight="duotone" className="mx-auto mb-1 text-slate-500" />
            <p className="text-sm font-bold leading-tight text-foreground tabular-nums sm:text-2xl">{formatCurrency(totalValue)}</p>
            <p className="text-[11px] leading-tight text-muted-foreground sm:text-xs">Stock Value</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <MagnifyingGlass size={16} weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search products..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <MobileSelect
          value={filterCategory}
          onValueChange={setFilterCategory}
          placeholder="Category"
          triggerClassName="w-full sm:w-44"
          options={[{ value: "all", label: "All Categories" }, ...CATEGORIES.map(c => ({ value: c, label: c }))]}
        />
        <MobileSelect
          value={filterStock}
          onValueChange={setFilterStock}
          placeholder="Stock"
          triggerClassName="w-full sm:w-36"
          options={[
            { value: "all", label: "All Stock" },
            { value: "low", label: "Low Stock" },
            { value: "out", label: "Out of Stock" },
            { value: "ok", label: "In Stock" },
          ]}
        />
      </div>

      {/* Products Table */}
      {loading ? (
        <div className="text-center py-12"><ArrowsClockwise className="animate-spin mx-auto text-muted-foreground" size={32} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <Package size={44} weight="duotone" className="mx-auto text-muted-foreground/60 mb-3" />
          <p className="text-muted-foreground">No products found</p>
          <Button onClick={openNew} className="mt-3 bg-green-600 hover:bg-green-700">Add Your First Product</Button>
        </div>
      ) : (
        <>
          {/* Small screens: one card per product, so nothing scrolls sideways */}
          <div className="space-y-2 sm:hidden">
            {filtered.map(product => {
              const isLow = product.stock_quantity <= (product.min_stock_level || 5);
              const isOut = product.stock_quantity === 0;
              return (
                <div key={product.id} className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package size={20} weight="duotone" className="text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {product.barcode || product.category || "No barcode"}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-bold text-foreground">{formatCurrency(product.selling_price)}</span>
                        {product.cost_price ? (
                          <span className="text-[11px] text-muted-foreground">Cost {formatCurrency(product.cost_price)}</span>
                        ) : null}
                        <Badge className={`${isOut ? "bg-red-100 text-red-700" : isLow ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"} text-[11px]`}>
                          {product.stock_quantity ?? "—"} in stock
                        </Badge>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => openEdit(product)} aria-label={`Edit ${product.name}`}>
                        <PencilSimple size={16} weight="regular" className="text-blue-500" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => handleDelete(product)} aria-label={`Delete ${product.name}`}>
                        <Trash size={16} weight="regular" className="text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Table from small screens up */}
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm sm:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border bg-muted/60">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Product</th>
                    <th className="hidden px-3 py-3 text-left text-xs font-semibold text-muted-foreground sm:table-cell">Category</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground">Price</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground">Stock</th>
                    <th className="hidden px-3 py-3 text-right text-xs font-semibold text-muted-foreground md:table-cell">Value</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(product => {
                    const isLow = product.stock_quantity <= (product.min_stock_level || 5);
                    const isOut = product.stock_quantity === 0;
                    return (
                      <tr key={product.id} className="transition-colors hover:bg-muted/40">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                              {product.image_url ? (
                                <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                              ) : (
                                <Package size={18} weight="duotone" className="text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
                              {product.barcode && <p className="text-xs text-muted-foreground">{product.barcode}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-3 py-3 sm:table-cell">
                          <Badge variant="outline" className="text-xs">{product.category || "—"}</Badge>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <p className="text-sm font-bold text-foreground">{formatCurrency(product.selling_price)}</p>
                          {product.cost_price && <p className="text-xs text-muted-foreground">Cost: {formatCurrency(product.cost_price)}</p>}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Badge className={`${isOut ? "bg-red-100 text-red-700" : isLow ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"} text-xs`}>
                            {product.stock_quantity ?? "—"}
                          </Badge>
                        </td>
                        <td className="hidden px-3 py-3 text-right md:table-cell">
                          <p className="text-sm text-muted-foreground">{formatCurrency((product.cost_price || 0) * (product.stock_quantity || 0))}</p>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex justify-end gap-0.5">
                            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => openEdit(product)} aria-label={`Edit ${product.name}`}>
                              <PencilSimple size={17} weight="regular" className="text-blue-500" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => handleDelete(product)} aria-label={`Delete ${product.name}`}>
                              <Trash size={17} weight="regular" className="text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Product Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="sm:col-span-2">
              <Label>Product Photo</Label>
              <div className="mt-1">
                <ProductImageUpload value={form.image_url || ""} onChange={(url) => setForm({ ...form, image_url: url })} />
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label>Product Name *</Label>
              <Input className="mt-1" placeholder="e.g. White Bread 700g" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div>
              <Label>Barcode</Label>
              <Input className="mt-1" placeholder="Scan or type barcode" value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} />
            </div>
            <div>
              <Label>Category</Label>
              <MobileSelect
                value={form.category}
                onValueChange={v => setForm({...form, category: v})}
                placeholder="Select category"
                triggerClassName="mt-1"
                options={CATEGORIES.map(c => ({ value: c, label: c }))}
              />
            </div>
            <div>
              <Label>Cost Price (R) *</Label>
              <Input className="mt-1" type="number" placeholder="0.00" value={form.cost_price} onChange={e => setForm({...form, cost_price: e.target.value})} />
            </div>
            <div>
              <Label>Selling Price (R) *</Label>
              <Input className="mt-1" type="number" placeholder="0.00" value={form.selling_price} onChange={e => setForm({...form, selling_price: e.target.value})} />
            </div>
            {form.cost_price && form.selling_price && (
              <div className="sm:col-span-2 bg-muted rounded-xl p-3 text-sm">
                <span className="text-foreground font-medium">
                  Markup: {(((parseFloat(form.selling_price) - parseFloat(form.cost_price)) / parseFloat(form.cost_price)) * 100).toFixed(1)}%
                  · Profit per unit: R {(parseFloat(form.selling_price) - parseFloat(form.cost_price)).toFixed(2)}
                </span>
              </div>
            )}
            <div>
              <Label>Current Stock</Label>
              <Input className="mt-1" type="number" placeholder="0" value={form.stock_quantity} onChange={e => setForm({...form, stock_quantity: e.target.value})} />
            </div>
            <div>
              <Label>Unit</Label>
              <MobileSelect
                value={form.unit}
                onValueChange={v => setForm({...form, unit: v})}
                placeholder="Unit"
                triggerClassName="mt-1"
                options={["each", "kg", "litre", "pack", "box", "dozen", "gram", "ml"].map(u => ({ value: u, label: u }))}
              />
            </div>
            <div>
              <Label>Min Stock Level (Alert)</Label>
              <Input className="mt-1" type="number" placeholder="5" value={form.min_stock_level} onChange={e => setForm({...form, min_stock_level: e.target.value})} />
            </div>
            <div>
              <Label>Max Stock Level</Label>
              <Input className="mt-1" type="number" placeholder="100" value={form.max_stock_level} onChange={e => setForm({...form, max_stock_level: e.target.value})} />
            </div>
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Input className="mt-1" placeholder="Any additional notes" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700">
              {saving ? "Saving..." : editProduct ? "Update Product" : "Add Product"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Product"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
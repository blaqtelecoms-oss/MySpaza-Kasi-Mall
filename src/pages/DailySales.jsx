import { useState, useMemo } from "react";
import { useEntityQuery } from "@/hooks/useEntityQuery";
import QueryRefreshIndicator from "@/components/QueryRefreshIndicator";
import {
  Receipt, CalendarBlank, Package, TrendUp, MagnifyingGlass, Warning, CaretDown, CaretRight,
} from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const formatCurrency = (n) => `R ${(n || 0).toFixed(2)}`;
const todayStr = () => new Date().toISOString().split("T")[0];
const monthStr = () => todayStr().slice(0, 7);

export default function DailySales() {
  const [view, setView] = useState("day"); // "day" | "month"
  const [day, setDay] = useState(todayStr());
  const [month, setMonth] = useState(monthStr());
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);

  const salesQuery = useEntityQuery("Sale", "list", ["-sale_date", 500]);
  const productsQuery = useEntityQuery("Product", "filter", [{ is_active: true }]);
  const sales = salesQuery.data || [];
  const products = productsQuery.data || [];

  const inRange = useMemo(() => {
    const completed = sales.filter(s => s.status === "completed");
    if (view === "day") return completed.filter(s => s.sale_date === day);
    return completed.filter(s => (s.sale_date || "").startsWith(month));
  }, [sales, view, day, month]);

  const totalSales = inRange.reduce((s, x) => s + (x.total_amount || 0), 0);
  const totalItems = inRange.reduce((s, x) => s + (x.items?.reduce((q, i) => q + (i.quantity || 0), 0) || 0), 0);

  // Aggregate items sold by product for inventory audit.
  const itemAudit = useMemo(() => {
    const map = new Map();
    inRange.forEach(sale => {
      (sale.items || []).forEach(item => {
        const key = item.product_id || item.name || "(unknown)";
        const cur = map.get(key) || { name: item.name || "(unknown)", qty: 0, revenue: 0 };
        cur.qty += item.quantity || 0;
        cur.revenue += (item.line_total || (item.price || 0) * (item.quantity || 0));
        map.set(key, cur);
      });
    });
    const rows = Array.from(map.values()).map(row => {
      const product = products.find(p => p.id === row.id || p.name === row.name);
      return { ...row, stock: product?.stock_quantity ?? null };
    });
    // attach product_id for stock lookup
    const withId = Array.from(map.entries()).map(([id, row]) => {
      const product = products.find(p => p.id === id || p.name === row.name);
      return { id, ...row, stock: product?.stock_quantity ?? null, unit: product?.unit || "" };
    });
    return withId;
  }, [inRange, products]);

  const filteredAudit = itemAudit.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
  const filteredSales = inRange.filter(s =>
    (s.sale_number || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.cashier_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const periodLabel = view === "day"
    ? new Date(day + "T00:00:00").toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : new Date(month + "-01T00:00:00").toLocaleDateString("en-ZA", { month: "long", year: "numeric" });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">Daily Sales Report</h1>
          <p className="truncate text-sm text-muted-foreground">{periodLabel}</p>
        </div>
        <QueryRefreshIndicator isFetching={salesQuery.isFetching || productsQuery.isFetching} hasData={sales.length > 0} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant={view === "day" ? "default" : "outline"} size="sm" onClick={() => setView("day")}>
              <CalendarBlank size={14} weight="bold" /> By Day
            </Button>
            <Button variant={view === "month" ? "default" : "outline"} size="sm" onClick={() => setView("month")}>
              <CalendarBlank size={14} weight="bold" /> By Month
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {view === "day" ? (
              <div>
                <Label className="text-sm text-muted-foreground">Date</Label>
                <Input type="date" value={day} onChange={e => setDay(e.target.value)} />
              </div>
            ) : (
              <div>
                <Label className="text-sm text-muted-foreground">Month</Label>
                <Input type="month" value={month} onChange={e => setMonth(e.target.value)} />
              </div>
            )}
            <div>
              <Label className="text-sm text-muted-foreground">Search items / receipts</Label>
              <div className="relative">
                <MagnifyingGlass size={14} weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card>
          <CardContent className="p-2.5 sm:p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Receipt size={14} weight="duotone" className="shrink-0" />
              <span className="truncate text-[11px] sm:text-xs">Transactions</span>
            </div>
            <p className="mt-1 text-base font-bold tabular-nums sm:text-xl">{inRange.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2.5 sm:p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <TrendUp size={14} weight="duotone" className="shrink-0" />
              <span className="truncate text-[11px] sm:text-xs">Total Sales</span>
            </div>
            <p className="mt-1 text-sm font-bold tabular-nums text-green-700 sm:text-xl">{formatCurrency(totalSales)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2.5 sm:p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Package size={14} weight="duotone" className="shrink-0" />
              <span className="truncate text-[11px] sm:text-xs">Items Sold</span>
            </div>
            <p className="mt-1 text-base font-bold tabular-nums sm:text-xl">{totalItems}</p>
          </CardContent>
        </Card>
      </div>

      {/* Items audit vs inventory */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Package size={16} weight="duotone" className="shrink-0 text-slate-600" /> Items Sold — Inventory Audit</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left p-2 font-medium sm:p-3">Product</th>
                  <th className="text-right p-2 font-medium sm:p-3">Qty Sold</th>
                  <th className="hidden text-right p-2 font-medium sm:table-cell sm:p-3">Revenue</th>
                  <th className="text-right p-2 font-medium sm:p-3">Stock</th>
                  <th className="text-left p-2 font-medium sm:p-3">Audit</th>
                </tr>
              </thead>
              <tbody>
                {filteredAudit.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No items sold in this period.</td></tr>
                )}
                {filteredAudit.map(row => {
                  const lowStock = row.stock !== null && row.stock <= 5;
                  const mismatch = row.stock !== null && row.stock < 0;
                  return (
                    <tr key={row.id} className="border-t">
                      <td className="max-w-[8rem] truncate p-2 font-medium sm:max-w-none sm:p-3">{row.name}</td>
                      <td className="whitespace-nowrap p-2 text-right sm:p-3">{row.qty} {row.unit}</td>
                      <td className="hidden whitespace-nowrap p-2 text-right sm:table-cell sm:p-3">{formatCurrency(row.revenue)}</td>
                      <td className="p-2 text-right sm:p-3">{row.stock === null ? "—" : row.stock}</td>
                      <td className="p-2 sm:p-3">
                        {mismatch ? (
                          <Badge variant="destructive" className="gap-1 whitespace-nowrap text-[10px] sm:text-xs"><Warning size={11} weight="bold" /> Mismatch</Badge>
                        ) : lowStock ? (
                          <Badge variant="secondary" className="gap-1 whitespace-nowrap bg-amber-100 text-[10px] text-amber-700 sm:text-xs">Low stock</Badge>
                        ) : row.stock === null ? (
                          <Badge variant="outline" className="whitespace-nowrap text-[10px] sm:text-xs">Not tracked</Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1 bg-green-100 text-[10px] text-green-700 sm:text-xs">OK</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Sales list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Receipt size={16} weight="duotone" className="shrink-0 text-slate-600" /> Sales ({filteredSales.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {filteredSales.length === 0 && (
              <p className="p-6 text-center text-muted-foreground">No sales in this period.</p>
            )}
            {filteredSales.map(sale => {
              const open = expanded === sale.id;
              const itemsCount = sale.items?.reduce((q, i) => q + (i.quantity || 0), 0) || 0;
              return (
                <div key={sale.id}>
                  <button
                    className="flex w-full flex-wrap items-center justify-between gap-2 p-3 text-left hover:bg-muted/40"
                    onClick={() => setExpanded(open ? null : sale.id)}
                  >
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                      {open ? <CaretDown size={16} weight="bold" className="shrink-0" /> : <CaretRight size={16} weight="bold" className="shrink-0" />}
                      <div className="min-w-0">
                        <p className="truncate font-medium">{sale.sale_number || sale.receipt_number || "Sale"}</p>
                        <p className="truncate text-xs text-muted-foreground">{sale.sale_date} · {itemsCount} items · {sale.cashier_name || "Owner"}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                      <Badge variant="outline" className="capitalize text-[10px] sm:text-xs">{sale.payment_method}</Badge>
                      <span className="font-bold">{formatCurrency(sale.total_amount)}</span>
                    </div>
                  </button>
                  {open && sale.items?.length > 0 && (
                    <div className="px-3 pb-3 sm:px-12">
                      <table className="w-full text-sm">
                        <thead className="text-muted-foreground">
                          <tr>
                            <th className="text-left py-1 font-medium">Item</th>
                            <th className="text-right py-1 font-medium">Qty</th>
                            <th className="text-right py-1 font-medium">Price</th>
                            <th className="text-right py-1 font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sale.items.map((item, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="py-1">{item.name}</td>
                              <td className="py-1 text-right">{item.quantity}</td>
                              <td className="py-1 text-right">{formatCurrency(item.price)}</td>
                              <td className="py-1 text-right">{formatCurrency(item.line_total || (item.price || 0) * (item.quantity || 0))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
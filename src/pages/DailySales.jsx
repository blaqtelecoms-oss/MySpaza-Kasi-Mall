import { useState, useMemo } from "react";
import { useEntityQuery } from "@/hooks/useEntityQuery";
import QueryRefreshIndicator from "@/components/QueryRefreshIndicator";
import { Receipt, Calendar, Package, TrendingUp, Search, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Daily Sales Report</h1>
          <p className="text-sm text-muted-foreground">{periodLabel}</p>
        </div>
        <QueryRefreshIndicator isFetching={salesQuery.isFetching || productsQuery.isFetching} hasData={sales.length > 0} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex gap-2">
            <Button variant={view === "day" ? "default" : "outline"} size="sm" onClick={() => setView("day")}>
              <Calendar size={14} /> By Day
            </Button>
            <Button variant={view === "month" ? "default" : "outline"} size="sm" onClick={() => setView("month")}>
              <Calendar size={14} /> By Month
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
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground"><Receipt size={14} /><span className="text-xs">Transactions</span></div>
            <p className="text-xl font-bold mt-1">{inRange.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground"><TrendingUp size={14} /><span className="text-xs">Total Sales</span></div>
            <p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(totalSales)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground"><Package size={14} /><span className="text-xs">Items Sold</span></div>
            <p className="text-xl font-bold mt-1">{totalItems}</p>
          </CardContent>
        </Card>
      </div>

      {/* Items audit vs inventory */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Package size={16} /> Items Sold — Inventory Audit</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left p-3 font-medium">Product</th>
                  <th className="text-right p-3 font-medium">Qty Sold</th>
                  <th className="text-right p-3 font-medium">Revenue</th>
                  <th className="text-right p-3 font-medium">Stock Now</th>
                  <th className="text-left p-3 font-medium">Audit</th>
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
                      <td className="p-3 font-medium">{row.name}</td>
                      <td className="p-3 text-right">{row.qty} {row.unit}</td>
                      <td className="p-3 text-right">{formatCurrency(row.revenue)}</td>
                      <td className="p-3 text-right">{row.stock === null ? "—" : row.stock}</td>
                      <td className="p-3">
                        {mismatch ? (
                          <Badge variant="destructive" className="gap-1"><AlertTriangle size={11} /> Stock mismatch</Badge>
                        ) : lowStock ? (
                          <Badge variant="secondary" className="gap-1 text-amber-700 bg-amber-100">Low stock</Badge>
                        ) : row.stock === null ? (
                          <Badge variant="outline">Not in inventory</Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1 text-green-700 bg-green-100">OK</Badge>
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
          <CardTitle className="text-base flex items-center gap-2"><Receipt size={16} /> Sales ({filteredSales.length})</CardTitle>
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
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/40 text-left"
                    onClick={() => setExpanded(open ? null : sale.id)}
                  >
                    <div className="flex items-center gap-3">
                      {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <div>
                        <p className="font-medium">{sale.sale_number || sale.receipt_number || "Sale"}</p>
                        <p className="text-xs text-muted-foreground">{sale.sale_date} · {itemsCount} items · {sale.cashier_name || "Owner"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="capitalize">{sale.payment_method}</Badge>
                      <span className="font-bold">{formatCurrency(sale.total_amount)}</span>
                    </div>
                  </button>
                  {open && sale.items?.length > 0 && (
                    <div className="px-12 pb-3">
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
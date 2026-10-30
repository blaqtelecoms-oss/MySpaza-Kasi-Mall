import { useState } from "react";
import { Plus, Minus, Trash2, ShoppingCart, Tag, User, UserPlus, X, Search, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const formatCurrency = (amount) => `R ${(amount || 0).toFixed(2)}`;

export default function CartContents({
  cart, updateQty, removeFromCart, onClear,
  subtotal, discountAmount, total, discount, setDiscount, onCharge,
  customers = [], selectedCustomer, onSelectCustomer, onClearCustomer,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [custSearch, setCustSearch] = useState("");

  const filteredCustomers = customers
    .filter(c => !custSearch || c.name?.toLowerCase().includes(custSearch.toLowerCase()) || c.phone?.includes(custSearch))
    .slice(0, 50);

  const pick = (id) => {
    onSelectCustomer(id);
    setPickerOpen(false);
    setCustSearch("");
  };

  return (
    <>
      {/* Customer selector */}
      <div className="px-3 pt-3 flex-shrink-0">
        {selectedCustomer ? (
          <div className="flex items-center justify-between gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl p-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                <User size={16} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-200 truncate">{selectedCustomer.name}</p>
                {(selectedCustomer.outstanding_balance || 0) > 0 && (
                  <p className="text-xs text-red-600 dark:text-red-400">Owes {formatCurrency(selectedCustomer.outstanding_balance)}</p>
                )}
              </div>
            </div>
            <button onClick={onClearCustomer} className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900">
              <X size={16} className="text-blue-600 dark:text-blue-300" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setPickerOpen(true)}
            className="w-full flex items-center justify-between gap-2 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-2.5 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <UserPlus size={16} /> Add customer (for credit sales)
            </span>
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-300">
            <ShoppingCart size={48} className="mb-2 opacity-50" />
            <p className="text-sm">Tap products to add</p>
          </div>
        ) : (
          cart.map(item => (
            <div key={item.product_id} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 flex-1 leading-tight">{item.name}</p>
                <button onClick={() => removeFromCart(item.product_id)} className="p-1 -m-1">
                  <Trash2 size={16} className="text-red-400 hover:text-red-600" />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQty(item.product_id, -1)}
                    className="w-11 h-11 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-red-100 active:scale-95 transition-transform"
                  >
                    <Minus size={18} />
                  </button>
                  <span className="text-base font-bold w-8 text-center text-gray-800 dark:text-gray-100">{item.quantity}</span>
                  <button
                    onClick={() => updateQty(item.product_id, 1)}
                    className="w-11 h-11 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-green-100 active:scale-95 transition-transform"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{formatCurrency(item.line_total)}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t p-4 space-y-3 flex-shrink-0">
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount ({discount}%)</span>
              <span>-{formatCurrency(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg text-gray-900 dark:text-gray-100 border-t pt-2">
            <span>TOTAL</span>
            <span className="text-green-700 dark:text-green-400">{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tag size={16} className="text-gray-400" />
          <Input
            type="number"
            placeholder="Discount %"
            value={discount || ""}
            onChange={e => setDiscount(Math.min(100, parseFloat(e.target.value) || 0))}
            className="h-8 text-sm"
          />
        </div>

        <Button
          onClick={onCharge}
          disabled={cart.length === 0}
          className="w-full h-16 rounded-2xl border-0 bg-gradient-to-b from-[#00C46A] to-[#009B4D] text-lg font-bold text-white shadow-lg shadow-emerald-900/25 transition-all hover:from-[#00D073] hover:to-[#00A859] hover:shadow-xl hover:shadow-emerald-900/30 active:scale-[0.99] disabled:from-gray-300 disabled:to-gray-400 disabled:shadow-none"
        >
          <span className="flex items-center justify-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 ring-1 ring-inset ring-white/35">
              <Check size={18} strokeWidth={3} />
            </span>
            <span className="text-[1.05rem] tracking-tight">
              Charge {formatCurrency(total)}
            </span>
          </span>
        </Button>

        {cart.length > 0 && (
          <button onClick={onClear} className="w-full text-xs text-red-400 hover:text-red-600 py-1">
            Clear Sale
          </button>
        )}
      </div>

      {/* Customer picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>Select Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or phone..."
                className="pl-10"
                value={custSearch}
                onChange={e => setCustSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-80 overflow-y-auto space-y-1">
              {filteredCustomers.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">No customers found</p>
              ) : (
                filteredCustomers.map(c => (
                  <button
                    key={c.id}
                    onClick={() => pick(c.id)}
                    className="w-full flex items-center justify-between gap-2 p-3 rounded-xl hover:bg-muted text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                      {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                    </div>
                    {(c.outstanding_balance || 0) > 0 && (
                      <Badge variant="destructive" className="text-[10px] flex-shrink-0">
                        Owes {formatCurrency(c.outstanding_balance)}
                      </Badge>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
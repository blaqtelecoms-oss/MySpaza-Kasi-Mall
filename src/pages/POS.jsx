import { useState } from "react";
import { api } from "@/api/client";
import { useEntityQuery, useInvalidateEntity, entityQueryKey } from "@/hooks/useEntityQuery";
import { useQueryClient } from "@tanstack/react-query";
import QueryRefreshIndicator from "@/components/QueryRefreshIndicator";
import { Search, ShoppingCart, CheckCircle, Printer, Send, WifiOff, Check } from "lucide-react";
import {
  Money, Bank, DeviceMobile, QrCode, Receipt as ReceiptIcon, Package as PackageIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/use-toast";
import CartContents from "@/components/pos/CartContents";
import { toShopSettings } from "@/lib/shopSettings";
import { printReceipt } from "@/lib/receipt";

const formatCurrency = (amount) => `R ${(amount || 0).toFixed(2)}`;

const PAYMENT_METHODS = [
  { id: "cash", label: "Cash", icon: Money, color: "bg-green-500" },
  { id: "card", label: "Card", icon: CreditCard, color: "bg-blue-500" },
  { id: "eft", label: "EFT", icon: Bank, color: "bg-purple-500" },
  { id: "mobile_money", label: "Mobile", icon: DeviceMobile, color: "bg-yellow-500" },
  { id: "qr_code", label: "QR Code", icon: QrCode, color: "bg-teal-500" },
  { id: "credit", label: "Credit", icon: ReceiptIcon, color: "bg-orange-500" },
];

export default function POS() {
  const productsQuery = useEntityQuery("Product", "filter", [{ is_active: true }]);
  const products = productsQuery.data || [];
  const customersQuery = useEntityQuery("Customer", "filter", [{ is_active: true }]);
  const customers = customersQuery.data || [];
  // Business details, logo and receipt options saved in Settings.
  const shopSettingsQuery = useEntityQuery("ShopSettings", "filter", [{}]);
  const shopSettings = toShopSettings(shopSettingsQuery.data?.[0]);
  const invalidateProduct = useInvalidateEntity();
  const queryClient = useQueryClient();
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [paymentModal, setPaymentModal] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState("cash");
  const [amountTendered, setAmountTendered] = useState("");
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [savedOffline, setSavedOffline] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const { toast } = useToast();

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId) || null;
  const isCredit = selectedPayment === "credit";

  const categories = ["all", ...new Set(products.map(p => p.category).filter(Boolean))];

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.includes(search));
    const matchCat = selectedCategory === "all" || p.category === selectedCategory;
    return matchSearch && matchCat;
  });

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        return prev.map(i => i.product_id === product.id
          ? { ...i, quantity: i.quantity + 1, line_total: (i.quantity + 1) * i.price }
          : i
        );
      }
      return [...prev, {
        product_id: product.id,
        name: product.name,
        price: product.selling_price,
        cost_price: product.cost_price || 0,
        quantity: 1,
        line_total: product.selling_price,
      }];
    });
  };

  const updateQty = (productId, delta) => {
    setCart(prev => prev
      .map(i => i.product_id === productId
        ? { ...i, quantity: i.quantity + delta, line_total: (i.quantity + delta) * i.price }
        : i
      )
      .filter(i => i.quantity > 0)
    );
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(i => i.product_id !== productId));
  };

  const subtotal = cart.reduce((sum, i) => sum + i.line_total, 0);
  const discountAmount = (subtotal * discount) / 100;
  const total = subtotal - discountAmount;
  const change = parseFloat(amountTendered || 0) - total;
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const creditLimit = selectedCustomer?.credit_limit || 0;
  const hasCreditLimit = isCredit && creditLimit > 0;
  const availableCredit = hasCreditLimit ? Math.max(0, creditLimit - (selectedCustomer?.outstanding_balance || 0)) : 0;
  const creditExceeded = hasCreditLimit && total > availableCredit;

  const completeSale = async () => {
    if (cart.length === 0) return;
    const saleCart = cart;
    const saleNumber = `S${Date.now().toString().slice(-6)}`;
    let selectedCustomerRef = selectedCustomer;
    setLoading(true);

    try {
      if (isCredit && !selectedCustomer) {
        toast({ title: "Select a customer", description: "Credit sales require a customer on the cart.", variant: "destructive" });
        setLoading(false);
        return;
      }

      if (isCredit && selectedCustomer) {
        // Re-fetch the customer from the server so the credit check uses the
        // authoritative outstanding balance — the cached copy can be stale
        // after a previous credit sale whose balance update hasn't refetched.
        let freshCustomer = selectedCustomer;
        try {
          freshCustomer = await api.entities.Customer.get(selectedCustomer.id);
        } catch (e) {
          /* fall back to cached customer if the fresh fetch fails (e.g. offline) */
        }
        const limit = freshCustomer?.credit_limit || 0;
        if (limit > 0) {
          const owing = freshCustomer?.outstanding_balance || 0;
          const available = Math.max(0, limit - owing);
          if (total > available) {
            toast({
              title: "Credit limit exceeded",
              description: `${selectedCustomer.name} has R ${available.toFixed(2)} available (limit R ${limit.toFixed(2)}, owing R ${owing.toFixed(2)}). This sale is R ${total.toFixed(2)}.`,
              variant: "destructive",
            });
            setLoading(false);
            return;
          }
        }
        selectedCustomerRef = freshCustomer;
      }

      // 1. Record the sale — must succeed before declaring success.
      //    When offline, the transparent offline layer queues the write to
      //    IndexedDB and returns a temporary record (id starts with "tmp_").
      //    The sync engine replays it against the server on reconnect.
      const saleResult = await api.entities.Sale.create({
        sale_number: saleNumber,
        items: saleCart,
        subtotal,
        discount_amount: discountAmount,
        vat_amount: 0,
        total_amount: total,
        payment_method: selectedPayment,
        amount_tendered: isCredit ? 0 : (parseFloat(amountTendered) || total),
        change_given: isCredit ? 0 : Math.max(0, change),
        customer_id: selectedCustomer ? selectedCustomer.id : undefined,
        status: "completed",
        receipt_number: saleNumber,
        sale_date: new Date().toISOString().split("T")[0],
        cashier_name: "Owner",
      });

      const wasQueued = !!(saleResult && saleResult.id && saleResult.id.startsWith("tmp_"));
      setSavedOffline(wasQueued);
      if (wasQueued) {
        toast({
          title: "Recorded offline",
          description: "Sale saved on this device. It will sync automatically when you reconnect.",
        });
      }

      // 2. Optimistic stock decrement in the UI
      queryClient.setQueryData(entityQueryKey("Product", "filter", [{ is_active: true }]), (prev) =>
        (prev || []).map(p => {
          const item = saleCart.find(i => i.product_id === p.id);
          return item ? { ...p, stock_quantity: Math.max(0, (p.stock_quantity || 0) - item.quantity) } : p;
        })
      );

      // 3. Persist stock changes (best effort, non-blocking)
      Promise.all(saleCart.map(item => {
        const product = products.find(p => p.id === item.product_id);
        return api.entities.Product.update(item.product_id, {
          stock_quantity: Math.max(0, (product?.stock_quantity || 0) - item.quantity),
        });
      }))
        .then(() => { invalidateProduct("Product"); })
        .catch(() => { /* stock sync is non-fatal */ });

      // 4. For credit sales, increase the customer's outstanding balance.
      if (isCredit && selectedCustomer) {
        const ref = selectedCustomerRef || selectedCustomer;
        const newBalance = (ref?.outstanding_balance || 0) + total;
        try {
          await api.entities.Customer.update(selectedCustomer.id, {
            outstanding_balance: newBalance,
          });
          // Optimistically reflect the new balance in the cached customer list
          // so the very next credit sale validates against a current balance.
          queryClient.setQueryData(entityQueryKey("Customer", "filter", [{ is_active: true }]), (prev) =>
            (prev || []).map(c => c.id === selectedCustomer.id ? { ...c, outstanding_balance: newBalance } : c)
          );
          invalidateProduct("Customer");
        } catch (err) {
          toast({ title: "Customer balance not updated", variant: "destructive" });
        }
      }

      invalidateProduct("Sale");

      setLastSale({
        receipt_number: saleNumber,
        total_amount: total,
        payment_method: selectedPayment,
        change_given: isCredit ? 0 : Math.max(0, change),
        customer_name: selectedCustomer ? selectedCustomer.name : null,
        items: saleCart,
        subtotal,
      });
      setCart([]);
      setDiscount(0);
      setAmountTendered("");
      setSelectedCustomerId(null);
      setPaymentModal(false);
      setSuccessModal(true);
    } catch (err) {
      toast({ title: "Sale failed", description: "Could not save the sale. Please retry.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openCharge = () => {
    setCartOpen(false);
    setPaymentModal(true);
  };

  return (
    <div className="h-full flex flex-row overflow-hidden bg-gray-50">
      {/* Products Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search & Filters */}
        <div className="p-3 bg-white border-b space-y-2">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search product or scan barcode..."
              className="pl-10 h-11 text-base"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <QueryRefreshIndicator isFetching={productsQuery.isFetching} hasData={products.length > 0} />
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat === "all" ? "All Items" : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ShoppingCart size={48} className="mx-auto mb-3 opacity-30" />
              <p>No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map(product => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="bg-white border-2 border-gray-100 hover:border-green-400 rounded-2xl p-3 text-left transition-all active:scale-95 shadow-sm hover:shadow-md"
                >
                  <div className="aspect-square bg-gradient-to-br from-green-50 to-blue-50 rounded-xl mb-2 flex items-center justify-center">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <PackageIcon size={30} weight="duotone" className="text-slate-400" />
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-tight">{product.name}</p>
                  <p className="text-green-700 font-bold mt-1">{formatCurrency(product.selling_price)}</p>
                  {product.stock_quantity !== undefined && (
                    <p className={`text-xs mt-0.5 ${product.stock_quantity <= (product.min_stock_level || 5) ? "text-red-500" : "text-gray-400"}`}>
                      Stock: {product.stock_quantity}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart Panel (desktop) */}
      <div className="hidden lg:flex w-80 xl:w-96 bg-white border-l flex-col shadow-xl flex-shrink-0">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <ShoppingCart size={20} className="text-green-600" />
              Current Sale
            </h2>
            <Badge className="bg-green-100 text-green-700">{cart.length} items</Badge>
          </div>
        </div>
        <CartContents
          cart={cart}
          updateQty={updateQty}
          removeFromCart={removeFromCart}
          onClear={() => setCart([])}
          subtotal={subtotal}
          discountAmount={discountAmount}
          total={total}
          discount={discount}
          setDiscount={setDiscount}
          onCharge={openCharge}
          customers={customers}
          selectedCustomer={selectedCustomer}
          onSelectCustomer={setSelectedCustomerId}
          onClearCustomer={() => setSelectedCustomerId(null)}
        />
      </div>

      {/* Mobile cart FAB */}
      <button
        onClick={() => setCartOpen(true)}
        className="lg:hidden fixed bottom-20 right-4 z-30 bg-green-600 text-white rounded-full h-16 w-16 shadow-xl flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Open cart"
      >
        <ShoppingCart size={26} />
        {cartCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center border-2 border-white">
            {cartCount}
          </span>
        )}
      </button>

      {/* Mobile cart drawer */}
      <Drawer open={cartOpen} onOpenChange={setCartOpen}>
        <DrawerContent className="h-[85vh] max-h-[85vh]">
          <DrawerHeader className="text-left pb-2">
            <DrawerTitle className="text-base flex items-center gap-2">
              <ShoppingCart size={18} className="text-green-600" /> Current Sale ({cart.length})
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col flex-1 min-h-0 px-4 pb-4">
            <CartContents
              cart={cart}
              updateQty={updateQty}
              removeFromCart={removeFromCart}
              onClear={() => setCart([])}
              subtotal={subtotal}
              discountAmount={discountAmount}
              total={total}
              discount={discount}
              setDiscount={setDiscount}
              onCharge={openCharge}
              customers={customers}
              selectedCustomer={selectedCustomer}
              onSelectCustomer={setSelectedCustomerId}
              onClearCustomer={() => setSelectedCustomerId(null)}
            />
          </div>
        </DrawerContent>
      </Drawer>

      {/* Payment Modal */}
      <Dialog open={paymentModal} onOpenChange={setPaymentModal}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>Select Payment Method</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map(pm => (
                <button
                  key={pm.id}
                  onClick={() => setSelectedPayment(pm.id)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                    selectedPayment === pm.id
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <pm.icon size={22} weight="duotone" className="text-slate-700" />
                  <span className="text-xs font-medium">{pm.label}</span>
                </button>
              ))}
            </div>

            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-gray-500 text-sm">Amount Due</p>
              <p className="text-3xl font-bold text-green-700">{formatCurrency(total)}</p>
            </div>

            {selectedPayment === "cash" && (
              <div>
                <Input
                  type="number"
                  placeholder="Amount tendered"
                  value={amountTendered}
                  onChange={e => setAmountTendered(e.target.value)}
                  className="h-12 text-lg text-center"
                />
                {parseFloat(amountTendered) >= total && (
                  <div className="mt-2 text-center">
                    <p className="text-sm text-gray-500">Change</p>
                    <p className="text-xl font-bold text-blue-600">{formatCurrency(change)}</p>
                  </div>
                )}
              </div>
            )}

            {isCredit && (
              <div className={`rounded-xl p-3 border ${selectedCustomer ? (creditExceeded ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200") : "bg-orange-50 border-orange-200"}`}>
                {selectedCustomer ? (
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-900">On credit: {selectedCustomer.name}</p>
                        <p className="text-xs text-orange-700">Added to their account balance</p>
                      </div>
                      <p className="font-bold text-orange-700">{formatCurrency(total)}</p>
                    </div>
                    {hasCreditLimit && (
                      <div className="mt-2 text-xs space-y-0.5">
                        <div className="flex justify-between"><span className="text-gray-500">Credit limit</span><span className="font-medium">{formatCurrency(creditLimit)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Currently owing</span><span className="font-medium text-red-600">{formatCurrency(selectedCustomer.outstanding_balance || 0)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Available</span><span className={`font-bold ${creditExceeded ? "text-red-600" : "text-green-600"}`}>{formatCurrency(availableCredit)}</span></div>
                        {creditExceeded && (
                          <p className="text-red-600 font-semibold pt-1">This sale exceeds available credit by {formatCurrency(total - availableCredit)}.</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-orange-700 font-medium text-center">
                    Add a customer to the cart to sell on credit.
                  </p>
                )}
              </div>
            )}

            <Button
              onClick={completeSale}
              disabled={loading || (selectedPayment === "cash" && parseFloat(amountTendered) < total) || (isCredit && !selectedCustomer) || creditExceeded}
              className="w-full h-16 rounded-2xl border-0 bg-gradient-to-b from-[#00C46A] to-[#009B4D] text-lg font-bold text-white shadow-lg shadow-emerald-900/25 transition-all hover:from-[#00D073] hover:to-[#00A859] hover:shadow-xl hover:shadow-emerald-900/30 active:scale-[0.99] disabled:from-gray-300 disabled:to-gray-400 disabled:shadow-none"
            >
              <span className="flex items-center justify-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 ring-1 ring-inset ring-white/35">
                  <Check size={18} strokeWidth={3} />
                </span>
                <span className="text-[1.05rem] tracking-tight">
                  {loading ? "Processing…" : "Complete Sale"}
                </span>
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={successModal} onOpenChange={setSuccessModal}>
        <DialogContent className="max-w-sm mx-auto text-center">
          <div className="py-4">
            <CheckCircle size={60} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800">Sale Complete!</h2>
            <p className="text-gray-500 mt-1">Receipt #{lastSale?.receipt_number}</p>
            {savedOffline && (
              <div className="mt-3 mx-auto max-w-xs flex items-center justify-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-amber-700 text-xs font-medium">
                <WifiOff size={14} /> Recorded offline — will sync when reconnected
              </div>
            )}
            <div className="bg-green-50 rounded-xl p-4 mt-4 text-left">
              <div className="flex justify-between text-sm">
                <span>Total</span>
                <span className="font-bold">{formatCurrency(lastSale?.total_amount)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>Payment</span>
                <span className="font-medium capitalize">{lastSale?.payment_method}</span>
              </div>
              {lastSale?.customer_name && (
                <div className="flex justify-between text-sm mt-1">
                  <span>Customer</span>
                  <span className="font-medium">{lastSale.customer_name}</span>
                </div>
              )}
              {lastSale?.change_given > 0 && (
                <div className="flex justify-between text-sm mt-1">
                  <span>Change</span>
                  <span className="font-bold text-blue-600">{formatCurrency(lastSale?.change_given)}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => printReceipt(lastSale, shopSettings)}
              >
                <Printer size={16} /> Print
              </Button>
              <Button variant="outline" className="flex-1 gap-2">
                <Send size={16} /> WhatsApp
              </Button>
            </div>
            <Button
              onClick={() => { setSuccessModal(false); setSavedOffline(false); }}
              className="w-full mt-2 bg-green-600 hover:bg-green-700"
            >
              New Sale
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
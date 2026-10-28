import { useState } from "react";
import { useEntityQuery, useInvalidateEntity } from "@/hooks/useEntityQuery";
import { base44 } from "@/api/base44Client";
import QueryRefreshIndicator from "@/components/QueryRefreshIndicator";
import {
  TrendingDown, Search, Phone, Wallet, CheckCircle, UserPlus, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";

const formatCurrency = (n) => `R ${(n || 0).toFixed(2)}`;

export default function DebtorsControl() {
  const customersQuery = useEntityQuery("Customer", "list", ["-outstanding_date", 200]);
  const invalidateCustomer = useInvalidateEntity();
  const navigate = useNavigate();
  const { toast } = useToast();

  const allCustomers = customersQuery.data || [];
  const [search, setSearch] = useState("");
  const [paymentFor, setPaymentFor] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const debtors = allCustomers
    .filter(c => (c.outstanding_balance || 0) > 0)
    .filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search));

  const totalDebt = debtors.reduce((sum, c) => sum + (c.outstanding_balance || 0), 0);
  const maxDebtor = debtors.reduce((max, c) => Math.max(max, c.outstanding_balance || 0), 0);

  const recordPayment = async () => {
    const amount = parseFloat(paymentAmount) || 0;
    if (!paymentFor || amount <= 0) return;
    setSaving(true);
    try {
      const newBalance = Math.max(0, (paymentFor.outstanding_balance || 0) - amount);
      await base44.entities.Customer.update(paymentFor.id, { outstanding_balance: newBalance });
      invalidateCustomer("Customer");
      toast({ title: "Payment recorded", description: `${formatCurrency(amount)} received from ${paymentFor.name}` });
      setPaymentFor(null);
      setPaymentAmount("");
    } catch (err) {
      toast({ title: "Failed to record payment", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-muted">
          <ArrowLeft size={20} className="text-foreground" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <TrendingDown size={24} className="text-red-500" />
            <h1 className="text-2xl font-bold text-foreground">Debtors Control</h1>
            <QueryRefreshIndicator isFetching={customersQuery.isFetching} hasData={allCustomers.length > 0} />
          </div>
          <p className="text-muted-foreground text-sm">Customers buying on credit and their outstanding balances</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-red-600 dark:text-red-400">Total Outstanding Debt</p>
            <p className="text-2xl font-bold text-red-700 dark:text-red-400">{formatCurrency(totalDebt)}</p>
          </CardContent>
        </Card>
        <Card className="bg-muted border-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Active Debtors</p>
            <p className="text-2xl font-bold text-foreground">{debtors.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search debtor by name or phone..."
          className="pl-10 h-11"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Debtors list */}
      {debtors.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle size={40} className="mx-auto mb-3 text-green-500" />
            <p className="font-medium text-foreground">No outstanding debt</p>
            <p className="text-sm text-muted-foreground mt-1">All customers are settled up.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {debtors.map(c => {
            const limit = c.credit_limit || 0;
            const usedPct = limit > 0 ? Math.min(100, ((c.outstanding_balance / limit) * 100)) : 0;
            return (
              <Card key={c.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground truncate">{c.name}</p>
                        {limit > 0 && usedPct >= 90 && (
                          <Badge variant="destructive" className="text-[10px]">Near limit</Badge>
                        )}
                      </div>
                      {c.phone && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone size={12} /> {c.phone}
                        </p>
                      )}
                      {limit > 0 && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Credit limit</span>
                            <span>{formatCurrency(c.outstanding_balance)} / {formatCurrency(limit)}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${usedPct >= 90 ? "bg-red-500" : "bg-yellow-500"}`}
                              style={{ width: `${usedPct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-muted-foreground">Owes</p>
                      <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatCurrency(c.outstanding_balance)}</p>
                      <Button
                        size="sm"
                        className="mt-2 bg-green-600 hover:bg-green-700 h-9"
                        onClick={() => { setPaymentFor(c); setPaymentAmount((c.outstanding_balance || 0).toFixed(2)); }}
                      >
                        <Wallet size={14} className="mr-1" /> Record Payment
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Payment Dialog */}
      <Dialog open={!!paymentFor} onOpenChange={(o) => !o && setPaymentFor(null)}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          {paymentFor && (
            <div className="space-y-4">
              <div className="bg-muted rounded-xl p-3">
                <p className="font-medium text-foreground">{paymentFor.name}</p>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Outstanding</span>
                  <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(paymentFor.outstanding_balance)}</span>
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Payment Amount</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">R</span>
                  <Input
                    type="number"
                    className="pl-7 h-12 text-lg"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    step="0.01"
                  />
                </div>
              </div>
              <Button
                onClick={recordPayment}
                disabled={saving || (parseFloat(paymentAmount) || 0) <= 0}
                className="w-full h-12 font-bold bg-green-600 hover:bg-green-700"
              >
                {saving ? "Saving..." : "Record Payment"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
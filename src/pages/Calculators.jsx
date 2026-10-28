import { useState } from "react";
import { Banknote, BarChart2, Receipt, Landmark, Scale, Tag, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const formatCurrency = (n) => `R ${(n || 0).toFixed(2)}`;

export default function Calculators() {
  // Profit Calculator
  const [profitCost, setProfitCost] = useState("");
  const [profitSell, setProfitSell] = useState("");
  const [profitQty, setProfitQty] = useState("");

  // Markup Calculator
  const [markupCost, setMarkupCost] = useState("");
  const [markupPercent, setMarkupPercent] = useState("");

  // VAT Calculator
  const [vatAmount, setVatAmount] = useState("");
  const [vatInclusive, setVatInclusive] = useState(true);

  // Loan Calculator
  const [loanAmount, setLoanAmount] = useState("");
  const [loanRate, setLoanRate] = useState("");
  const [loanMonths, setLoanMonths] = useState("");

  // Break-even Calculator
  const [fixedCosts, setFixedCosts] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [unitCost, setUnitCost] = useState("");

  // Pricing Calculator
  const [pricingCost, setPricingCost] = useState("");
  const [pricingMargin, setPricingMargin] = useState("");

  // Calculations
  const profitPerUnit = (parseFloat(profitSell) || 0) - (parseFloat(profitCost) || 0);
  const profitMargin = profitSell > 0 ? ((profitPerUnit / parseFloat(profitSell)) * 100) : 0;
  const profitMarkup = profitCost > 0 ? ((profitPerUnit / parseFloat(profitCost)) * 100) : 0;
  const totalProfit = profitPerUnit * (parseFloat(profitQty) || 1);

  const markupSellPrice = markupCost && markupPercent
    ? parseFloat(markupCost) * (1 + parseFloat(markupPercent) / 100)
    : 0;

  const vatRate = 0.15;
  const vatInput = parseFloat(vatAmount) || 0;
  const vatExclusive = vatInclusive ? vatInput / 1.15 : vatInput;
  const vatOnlyAmount = vatInclusive ? vatInput - vatExclusive : vatInput * vatRate;
  const vatInclAmount = vatInclusive ? vatInput : vatInput * 1.15;

  const loanP = parseFloat(loanAmount) || 0;
  const loanR = (parseFloat(loanRate) || 0) / 100 / 12;
  const loanN = parseInt(loanMonths) || 1;
  const loanMonthly = loanR > 0 ? loanP * (loanR * Math.pow(1 + loanR, loanN)) / (Math.pow(1 + loanR, loanN) - 1) : loanP / loanN;
  const loanTotal = loanMonthly * loanN;

  const fc = parseFloat(fixedCosts) || 0;
  const up = parseFloat(unitPrice) || 0;
  const uc = parseFloat(unitCost) || 0;
  const breakeven = (up - uc) > 0 ? fc / (up - uc) : 0;

  const priceSellForMargin = pricingCost && pricingMargin
    ? parseFloat(pricingCost) / (1 - parseFloat(pricingMargin) / 100)
    : 0;

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Business Calculators</h1>
        <p className="text-muted-foreground text-sm">Smart tools to help you make better business decisions</p>
      </div>

      <Tabs defaultValue="profit">
        <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full h-auto gap-1">
          <TabsTrigger value="profit" className="text-xs py-2">Profit</TabsTrigger>
          <TabsTrigger value="markup" className="text-xs py-2">Markup</TabsTrigger>
          <TabsTrigger value="vat" className="text-xs py-2">VAT</TabsTrigger>
          <TabsTrigger value="loan" className="text-xs py-2">Loan</TabsTrigger>
          <TabsTrigger value="breakeven" className="text-xs py-2">Break-even</TabsTrigger>
          <TabsTrigger value="pricing" className="text-xs py-2">Pricing</TabsTrigger>
        </TabsList>

        {/* Profit Calculator */}
        <TabsContent value="profit">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Banknote size={18} /> Profit Calculator</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>Cost Price (R)</Label>
                  <Input className="mt-1 h-12 text-lg" type="number" placeholder="0.00" value={profitCost} onChange={e => setProfitCost(e.target.value)} />
                </div>
                <div>
                  <Label>Selling Price (R)</Label>
                  <Input className="mt-1 h-12 text-lg" type="number" placeholder="0.00" value={profitSell} onChange={e => setProfitSell(e.target.value)} />
                </div>
                <div>
                  <Label>Quantity Sold</Label>
                  <Input className="mt-1 h-12 text-lg" type="number" placeholder="1" value={profitQty} onChange={e => setProfitQty(e.target.value)} />
                </div>
              </div>
              {profitCost && profitSell && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                  <ResultBox label="Profit per Unit" value={formatCurrency(profitPerUnit)} color={profitPerUnit >= 0 ? "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20" : "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/20"} />
                  <ResultBox label="Profit Margin" value={`${profitMargin.toFixed(1)}%`} color="text-foreground bg-muted" />
                  <ResultBox label="Markup %" value={`${profitMarkup.toFixed(1)}%`} color="text-foreground bg-muted" />
                  <ResultBox label="Total Profit" value={formatCurrency(totalProfit)} color={totalProfit >= 0 ? "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20" : "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/20"} />
                </div>
              )}
              <div className="bg-muted rounded-xl p-3 text-sm text-foreground flex items-start gap-2">
                <Lightbulb size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                <span><strong>Tip:</strong> A healthy spaza shop markup is usually between 15% and 40% depending on the product.</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Markup Calculator */}
        <TabsContent value="markup">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart2 size={18} /> Markup Calculator</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cost Price (R)</Label>
                  <Input className="mt-1 h-12 text-lg" type="number" placeholder="0.00" value={markupCost} onChange={e => setMarkupCost(e.target.value)} />
                </div>
                <div>
                  <Label>Markup (%)</Label>
                  <Input className="mt-1 h-12 text-lg" type="number" placeholder="25" value={markupPercent} onChange={e => setMarkupPercent(e.target.value)} />
                </div>
              </div>
              {markupCost && markupPercent && (
                <div className="grid grid-cols-2 gap-3">
                  <ResultBox label="Selling Price" value={formatCurrency(markupSellPrice)} color="text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20" />
                  <ResultBox label="Profit Amount" value={formatCurrency(markupSellPrice - parseFloat(markupCost))} color="text-foreground bg-muted" />
                </div>
              )}
              <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-xl p-4">
                <p className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2 text-sm">Common Spaza Markup Guide:</p>
                <div className="space-y-1 text-sm text-yellow-800 dark:text-yellow-400">
                  <p>Bread & Staples: 10-15%</p>
                  <p>Cooldrinks: 20-30%</p>
                  <p>Sweets & Snacks: 30-50%</p>
                  <p>Airtime & Data: 3-8%</p>
                  <p>Toiletries: 20-35%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* VAT Calculator */}
        <TabsContent value="vat">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Receipt size={18} /> VAT Calculator (15%)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3 mb-2">
                <button onClick={() => setVatInclusive(true)} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${vatInclusive ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"}`}>Price includes VAT</button>
                <button onClick={() => setVatInclusive(false)} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${!vatInclusive ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"}`}>Price excludes VAT</button>
              </div>
              <div>
                <Label>{vatInclusive ? "VAT-Inclusive Price (R)" : "VAT-Exclusive Price (R)"}</Label>
                <Input className="mt-1 h-14 text-xl text-center" type="number" placeholder="0.00" value={vatAmount} onChange={e => setVatAmount(e.target.value)} />
              </div>
              {vatAmount && (
                <div className="grid grid-cols-3 gap-3">
                  <ResultBox label="Excl. VAT" value={formatCurrency(vatExclusive)} color="text-foreground bg-muted" />
                  <ResultBox label="VAT Amount" value={formatCurrency(vatOnlyAmount)} color="text-foreground bg-muted" />
                  <ResultBox label="Incl. VAT" value={formatCurrency(vatInclAmount)} color="text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20" />
                </div>
              )}
              <div className="bg-muted rounded-xl p-3 text-sm text-foreground flex items-start gap-2">
                <Lightbulb size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                <span><strong>VAT Note:</strong> Basic food items like bread, maize meal, eggs, and milk are VAT-exempt (zero rated) in South Africa.</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Loan Calculator */}
        <TabsContent value="loan">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Landmark size={18} /> Loan Calculator</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>Loan Amount (R)</Label>
                  <Input className="mt-1 h-12 text-lg" type="number" placeholder="10000" value={loanAmount} onChange={e => setLoanAmount(e.target.value)} />
                </div>
                <div>
                  <Label>Annual Interest Rate (%)</Label>
                  <Input className="mt-1 h-12 text-lg" type="number" placeholder="15" value={loanRate} onChange={e => setLoanRate(e.target.value)} />
                </div>
                <div>
                  <Label>Term (Months)</Label>
                  <Input className="mt-1 h-12 text-lg" type="number" placeholder="12" value={loanMonths} onChange={e => setLoanMonths(e.target.value)} />
                </div>
              </div>
              {loanAmount && loanMonths && (
                <div className="grid grid-cols-3 gap-3">
                  <ResultBox label="Monthly Payment" value={formatCurrency(loanMonthly)} color="text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20" />
                  <ResultBox label="Total Repayment" value={formatCurrency(loanTotal)} color="text-foreground bg-muted" />
                  <ResultBox label="Total Interest" value={formatCurrency(loanTotal - parseFloat(loanAmount))} color="text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/20" />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Break-even Calculator */}
        <TabsContent value="breakeven">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Scale size={18} /> Break-Even Calculator</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>Monthly Fixed Costs (R)</Label>
                  <Input className="mt-1 h-12 text-lg" type="number" placeholder="e.g. Rent 3000" value={fixedCosts} onChange={e => setFixedCosts(e.target.value)} />
                </div>
                <div>
                  <Label>Avg Selling Price (R)</Label>
                  <Input className="mt-1 h-12 text-lg" type="number" placeholder="0.00" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} />
                </div>
                <div>
                  <Label>Avg Cost Price (R)</Label>
                  <Input className="mt-1 h-12 text-lg" type="number" placeholder="0.00" value={unitCost} onChange={e => setUnitCost(e.target.value)} />
                </div>
              </div>
              {fixedCosts && unitPrice && unitCost && (
                <div className="grid grid-cols-2 gap-3">
                  <ResultBox label="Break-even Units/Month" value={Math.ceil(breakeven).toString()} color="text-foreground bg-muted" />
                  <ResultBox label="Break-even Revenue" value={formatCurrency(breakeven * parseFloat(unitPrice))} color="text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20" />
                </div>
              )}
              <div className="bg-muted rounded-xl p-3 text-sm text-foreground flex items-start gap-2">
                <Lightbulb size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                <span>You need to sell at least this many units per month just to cover your fixed costs.</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pricing Calculator */}
        <TabsContent value="pricing">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Tag size={18} /> Pricing Calculator (Margin-Based)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cost Price (R)</Label>
                  <Input className="mt-1 h-12 text-lg" type="number" placeholder="0.00" value={pricingCost} onChange={e => setPricingCost(e.target.value)} />
                </div>
                <div>
                  <Label>Target Profit Margin (%)</Label>
                  <Input className="mt-1 h-12 text-lg" type="number" placeholder="25" value={pricingMargin} onChange={e => setPricingMargin(e.target.value)} />
                </div>
              </div>
              {pricingCost && pricingMargin && (
                <div className="grid grid-cols-2 gap-3">
                  <ResultBox label="Selling Price" value={formatCurrency(priceSellForMargin)} color="text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20" />
                  <ResultBox label="Profit Amount" value={formatCurrency(priceSellForMargin - parseFloat(pricingCost))} color="text-foreground bg-muted" />
                </div>
              )}
              <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-xl p-3 text-sm text-yellow-800 dark:text-yellow-300 flex items-start gap-2">
                <Lightbulb size={16} className="flex-shrink-0 mt-0.5" />
                <span><strong>Difference between Markup and Margin:</strong><br/>Markup is calculated on cost price. Margin is calculated on selling price.</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ResultBox({ label, value, color }) {
  return (
    <div className={`${color} rounded-xl p-4 text-center`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs mt-1 opacity-75">{label}</p>
    </div>
  );
}
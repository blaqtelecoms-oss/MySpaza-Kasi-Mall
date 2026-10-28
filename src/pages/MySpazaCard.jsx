import { useState } from "react";
import { useEntityQuery } from "@/hooks/useEntityQuery";
import { CreditCard, Tag, PiggyBank, Users, Boxes } from "lucide-react";
import CardDisplay from "@/components/myspazacard/CardDisplay";
import DiscountsTab from "@/components/myspazacard/DiscountsTab";
import StockfellTab from "@/components/myspazacard/StockfellTab";
import SavingsGroupsTab from "@/components/myspazacard/SavingsGroupsTab";
import BulkBuyTab from "@/components/myspazacard/BulkBuyTab";

const fmt = (a) => "R " + Number(a || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TABS = [
  { id: "discounts", label: "Discounts", icon: Tag },
  { id: "stockfell", label: "Stockfell", icon: PiggyBank },
  { id: "groups", label: "Savings Groups", icon: Users },
  { id: "bulk", label: "Bulk Buy", icon: Boxes },
];

export default function MySpazaCard() {
  const [tab, setTab] = useState("discounts");
  const stockfellQuery = useEntityQuery("StockfellAccount", "list", []);
  const discountsQuery = useEntityQuery("WholesalerDiscount", "list", []);
  const groupsQuery = useEntityQuery("SavingsGroup", "list", []);
  const bulkQuery = useEntityQuery("BulkBuy", "list", []);
  const stockfell = stockfellQuery.data || [];
  const stats = {
    savings: (stockfell[0] && stockfell[0].balance) || 0,
    discounts: (discountsQuery.data || []).filter(x => x.is_active).length,
    groups: (groupsQuery.data || []).length,
    bulk: (bulkQuery.data || []).filter(x => x.status === "open").length,
  };

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4 pb-10">
      {/* Header */}
      <div className="flex items-center gap-2">
        <CreditCard className="text-foreground" />
        <div>
          <h1 className="text-xl font-bold text-foreground">MySpaza Card</h1>
          <p className="text-xs text-muted-foreground">Discounts · Savings · Bulk Buying</p>
        </div>
      </div>

      {/* Card + Quick Stats */}
      <div className="grid sm:grid-cols-2 gap-4 items-center">
        <CardDisplay balance={stats.savings} />
        <div className="grid grid-cols-2 gap-2">
          <StatCard icon={PiggyBank} label="Savings Balance" value={fmt(stats.savings)} color="green" />
          <StatCard icon={Tag} label="Active Discounts" value={`${stats.discounts} tiers`} color="yellow" />
          <StatCard icon={Users} label="Savings Groups" value={stats.groups} color="neutral" />
          <StatCard icon={Boxes} label="Open Bulk Buys" value={stats.bulk} color="neutral" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.id ? "bg-green-600 text-white shadow" : "bg-muted text-muted-foreground hover:bg-muted/70 border border-border"
              }`}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {tab === "discounts" && <DiscountsTab />}
        {tab === "stockfell" && <StockfellTab />}
        {tab === "groups" && <SavingsGroupsTab />}
        {tab === "bulk" && <BulkBuyTab />}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    green: "bg-green-50 text-green-700 border-green-100 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900",
    yellow: "bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-950/20 dark:text-yellow-300 dark:border-yellow-900",
    neutral: "bg-muted text-foreground border-border",
  };
  return (
    <div className={`border rounded-xl p-3 ${colors[color]}`}>
      <Icon size={18} className="mb-1" />
      <p className="text-[11px] opacity-80">{label}</p>
      <p className="font-bold text-sm">{value}</p>
    </div>
  );
}
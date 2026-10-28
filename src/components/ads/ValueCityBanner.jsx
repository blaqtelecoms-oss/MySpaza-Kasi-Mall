import { ShoppingBag, Tag, Truck } from "lucide-react";

export default function ValueCityBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 via-red-700 to-rose-800 p-4 text-white shadow-md">
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full" />
      <div className="absolute -right-4 -bottom-8 w-20 h-20 bg-white/10 rounded-full" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-1.5">
          <img src="/brand/value-city.png" alt="Value City" className="w-14 h-14 rounded-lg object-contain bg-white/95 p-0.5 flex-shrink-0" />
          <div>
            <span className="text-[10px] uppercase tracking-wide font-semibold opacity-80 block">Sponsored</span>
            <h3 className="font-bold text-sm leading-tight">Value City — Wholesaler</h3>
          </div>
        </div>
        <p className="text-xs text-white/90 mb-2.5">
          Wholesale prices on stationery, appliances, tools, packaging & more. Stock your spaza shop for less.
        </p>
        <div className="space-y-1 text-xs text-white/90">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px]">✦ Bulk wholesale pricing</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px]">✦ Stationery, appliances, tools & more</span>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-white/20 text-[10px]">
          <span className="flex items-center gap-1"><Tag size={11} /> Low wholesale prices</span>
          <span className="flex items-center gap-1"><Truck size={11} /> Nationwide delivery</span>
          <a href="https://valuecity.co.za/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 ml-auto font-semibold underline">
            <ShoppingBag size={11} /> Shop Now
          </a>
        </div>
      </div>
    </div>
  );
}
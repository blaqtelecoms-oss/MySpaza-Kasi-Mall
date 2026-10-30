import { Calendar, Clock, MapPin, Globe } from "lucide-react";

export default function AmajubaBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl p-4 text-white shadow-md bg-gradient-to-br from-[#003366] to-[#00224a]">
      <div className="absolute -right-8 -top-4 w-28 h-28 bg-amber-500/20 rounded-full" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-1.5">
          <img src="/brand/amajuba.png" alt="Amajuba Chamber" className="w-12 h-12 rounded-lg object-contain flex-shrink-0" />
          <div>
            <span className="text-[10px] uppercase tracking-wide font-semibold opacity-80 block">Sponsored</span>
            <h3 className="font-bold text-sm leading-tight">Amajuba Economic Chamber</h3>
          </div>
        </div>
        <p className="text-xs text-white/90 mb-2">
          Driving sustainable economic development across the Amajuba District. 500+ members strong.
        </p>
        <div className="flex gap-2 mb-2.5">
          <span className="bg-amber-500/30 rounded-lg px-2 py-0.5 text-[10px] font-semibold">500+ Members</span>
          <span className="bg-amber-500/30 rounded-lg px-2 py-0.5 text-[10px] font-semibold">6 Municipalities</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-white/80 mb-1.5">
          <span className="flex items-center gap-1"><Calendar size={11} /> 08 Jul 2026</span>
          <span className="flex items-center gap-1"><Clock size={11} /> 10:00</span>
          <span className="flex items-center gap-1"><MapPin size={11} /> Blaubosch</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-amber-300">
          <Globe size={11} /> amajubaeconomicchamber.org
        </div>
      </div>
    </div>
  );
}
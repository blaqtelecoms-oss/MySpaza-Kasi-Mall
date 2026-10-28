import { Calendar, Clock, MapPin, Phone, Globe } from "lucide-react";

export default function SedfaBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-yellow-600 to-amber-700 p-4 text-white shadow-md">
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full" />
      <div className="absolute -right-4 -bottom-8 w-20 h-20 bg-white/10 rounded-full" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-1.5">
          <img src="https://media.base44.com/images/public/6a4415977639497c1bfe27ef/6a81bb333_dac220_9458957b3ee94aee936557ae113c1372_mv2-removebg-preview.png" alt="SEDFA" className="w-12 h-12 rounded-lg object-contain flex-shrink-0" />
          <div>
            <span className="text-[10px] uppercase tracking-wide font-semibold opacity-80 block">Sponsored</span>
            <h3 className="font-bold text-sm leading-tight">SEDFA — Finance Agency</h3>
          </div>
        </div>
        <p className="text-xs text-white/90 mb-2.5">
          Get financial & non-financial support for your small business. Register, formalise & access funding.
        </p>
        <div className="space-y-1 text-xs text-white/90">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px]">✦ Registration & formalising benefits</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px]">✦ Business support & development</span>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-white/20 text-[10px]">
          <span className="flex items-center gap-1"><Calendar size={11} /> 08 Jul 2026</span>
          <span className="flex items-center gap-1"><Clock size={11} /> 10:00 AM</span>
          <span className="flex items-center gap-1"><MapPin size={11} /> Blaubosch Youth Centre</span>
        </div>
      </div>
    </div>
  );
}
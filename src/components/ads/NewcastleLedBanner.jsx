import { Calendar, Clock, MapPin, Info } from "lucide-react";

export default function NewcastleLedBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-800 to-blue-900 p-4 text-white shadow-md">
      <div className="absolute -left-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-1.5">
          <img src="https://media.base44.com/images/public/6a4415977639497c1bfe27ef/073a0f2ad_newcastle-municipality-logo-removebg-preview.png" alt="Newcastle Municipality" className="w-12 h-12 rounded-lg object-contain flex-shrink-0" />
          <div>
            <span className="text-[10px] uppercase tracking-wide font-semibold opacity-80 block">Sponsored</span>
            <h3 className="font-bold text-sm leading-tight">Newcastle LED</h3>
          </div>
        </div>
        <p className="text-xs text-white/90 mb-2.5">
          Providing fund information, explaining application processes & answering your questions.
        </p>
        <div className="space-y-1 text-xs text-white/90">
          <div className="flex items-center gap-1.5"><Info size={10} /> <span className="text-[9px]">Fund info for spaza shops</span></div>
          <div className="flex items-center gap-1.5"><Info size={10} /> <span className="text-[9px]">Application process guidance</span></div>
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
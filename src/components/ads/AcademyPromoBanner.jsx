import { Link } from "react-router-dom";
import { GraduationCap, ArrowRight } from "lucide-react";
import { useSubscription } from "@/lib/SubscriptionContext";

const LOGO_URL = "/brand/logo.png";

/** A promotional banner, so it follows the plan's ads setting. */
export default function AcademyPromoBanner() {
  const { planInfo } = useSubscription();
  if (!planInfo.ads) return null;

  return (
    <Link
      to="/academy"
      className="block relative overflow-hidden rounded-2xl p-4 text-white shadow-md bg-gradient-to-br from-[#0D0D0D] to-[#1c1c1c]"
    >
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#D4A017]/20 rounded-full" />
      <div className="absolute -right-2 bottom-2 opacity-10">
        <GraduationCap size={90} />
      </div>

      <div className="relative flex items-center gap-3">
        <img src={LOGO_URL} alt="My Spaza" className="w-12 h-12 rounded-lg object-contain bg-white/10 p-1 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <GraduationCap size={14} className="text-[#D4A017]" />
            <span className="text-[10px] uppercase tracking-wide font-semibold text-[#D4A017]">Free Course</span>
          </div>
          <h3 className="font-bold text-sm leading-tight">Learn to run a profitable shop</h3>
          <p className="text-xs text-white/70 mt-0.5 line-clamp-2">
            Spaza Academy: 8 free courses on pricing, stock control, cash flow & more. Earn a certificate.
          </p>
        </div>
        <div className="flex-shrink-0 bg-[#D4A017] text-[#0D0D0D] rounded-full p-2">
          <ArrowRight size={18} />
        </div>
      </div>
    </Link>
  );
}
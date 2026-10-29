import { cn } from "@/lib/utils";

// One rounded tile behind every section icon, so headers across the app share
// the same weight, radius and stroke instead of each screen inventing its own.
const TONES = {
  teal: "bg-teal-50 text-teal-700 ring-teal-600/15",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  slate: "bg-slate-100 text-slate-700 ring-slate-900/10",
  ink: "bg-[#0D0D0D] text-[#FFD426] ring-black/20",
};

const SIZES = {
  sm: { box: "h-7 w-7 rounded-lg", icon: 14 },
  md: { box: "h-9 w-9 rounded-xl", icon: 18 },
};

export default function IconTile({ icon: Icon, tone = "teal", size = "md", className }) {
  const palette = TONES[tone] || TONES.teal;
  const scale = SIZES[size] || SIZES.md;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center ring-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]",
        palette,
        scale.box,
        className
      )}
    >
      {Icon ? <Icon size={scale.icon} strokeWidth={1.9} /> : null}
    </span>
  );
}

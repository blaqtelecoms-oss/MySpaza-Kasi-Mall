import { cn } from "@/lib/utils";

// One chip behind every section icon, so headers across the app share the same
// weight, radius and stroke. The chip stays neutral and the duotone icon carries
// the colour, which reads like a real product's icon set instead of a pastel badge.
const TONES = {
  teal: "text-teal-700",
  amber: "text-amber-600",
  slate: "text-slate-600",
  ink: "text-[#0D0D0D]",
  red: "text-red-600",
  green: "text-emerald-700",
  blue: "text-sky-700",
};

const SIZES = {
  sm: { box: "h-8 w-8 rounded-lg", icon: 18 },
  md: { box: "h-10 w-10 rounded-xl", icon: 22 },
};

export default function IconTile({ icon: Icon, tone = "teal", size = "md", weight = "fill", className }) {
  const palette = TONES[tone] || TONES.teal;
  const scale = SIZES[size] || SIZES.md;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]",
        palette,
        scale.box,
        className
      )}
    >
      {Icon ? <Icon size={scale.icon} weight={weight} /> : null}
    </span>
  );
}

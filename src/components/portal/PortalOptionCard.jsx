import { Lock } from "lucide-react";

/**
 * One choice on the portal screen: the owner portal or the cashier portal.
 * A portal this account cannot open is shown greyed out with the reason, so the
 * two options always read together.
 */
export default function PortalOptionCard({
  icon: Icon,
  title,
  subtitle,
  tone = "owner",
  disabled = false,
  action,
  hint,
}) {
  const iconClass = disabled
    ? "bg-slate-200 text-slate-400"
    : tone === "cashier"
      ? "bg-teal-600 text-white"
      : "bg-[#0D0D0D] text-[#FFD426]";

  return (
    <section
      className={`rounded-xl border p-4 ${
        disabled
          ? "border-slate-200 bg-slate-50"
          : "border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
          <Icon size={19} weight="fill" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={`text-sm font-semibold ${disabled ? "text-slate-500" : "text-slate-900"}`}>
            {title}
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{subtitle}</p>
        </div>
      </div>

      <div className="mt-3">{action}</div>

      {hint && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
          <Lock size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{hint}</span>
        </p>
      )}
    </section>
  );
}

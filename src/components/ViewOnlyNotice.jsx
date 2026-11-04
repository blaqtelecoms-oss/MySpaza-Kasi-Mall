import { Lock } from "lucide-react";

/**
 * Shown on a screen the session may open but not change, so a view-only
 * cashier understands why the add/edit/delete controls are missing.
 */
export default function ViewOnlyNotice({ screen }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
      <Lock size={16} className="mt-0.5 shrink-0" />
      <p>
        You have <span className="font-semibold">view-only</span> access to {screen}. Ask the
        store owner for edit access to make changes.
      </p>
    </div>
  );
}

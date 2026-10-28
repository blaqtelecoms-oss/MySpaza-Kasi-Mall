import { MODULES } from "@/lib/modules";
import { Label } from "@/components/ui/label";

const LEVELS = [
  { value: null, label: "None" },
  { value: "view", label: "View" },
  { value: "edit", label: "Edit" },
];

/**
 * Per-module access: `None` (not visible), `View` (read only) or `Edit` (may
 * create and change records). The database enforces the same three states.
 */
export default function PermissionEditor({ permissions, onChange }) {
  const setLevel = (key, level) => {
    const next = { ...permissions };
    if (!level) delete next[key];
    else next[key] = level;
    onChange(next);
  };

  const grantAll = (level) =>
    onChange(Object.fromEntries(MODULES.map((m) => [m.key, level])));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label>What they can see and do</Label>
        <div className="flex shrink-0 gap-3 text-xs">
          <button
            type="button"
            onClick={() => grantAll("view")}
            className="text-muted-foreground hover:text-foreground"
          >
            View all
          </button>
          <button
            type="button"
            onClick={() => onChange({})}
            className="text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto rounded-xl border border-border divide-y divide-border">
        {MODULES.map((module) => {
          const current = permissions[module.key] || null;
          return (
            <div key={module.key} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-sm text-foreground">{module.label}</span>
              <div className="flex overflow-hidden rounded-lg border border-border">
                {LEVELS.map((level) => {
                  const active = current === level.value;
                  return (
                    <button
                      key={level.label}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setLevel(module.key, level.value)}
                      className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        active
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {level.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

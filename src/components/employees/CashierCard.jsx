import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, KeyRound, Trash2 } from "lucide-react";
import { MODULE_LABELS } from "@/lib/modules";
import { roleLabel } from "@/lib/portalAccess";

function AccessChips({ permissions }) {
  const granted = Object.keys(permissions || {});
  if (granted.length === 0) {
    return <span className="text-xs text-muted-foreground">No screens yet</span>;
  }
  const shown = granted.slice(0, 3);
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((key) => (
        <span
          key={key}
          className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
        >
          {MODULE_LABELS[key] || key}
          {permissions[key] === "edit" ? " · edit" : ""}
        </span>
      ))}
      {granted.length > shown.length && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          +{granted.length - shown.length}
        </span>
      )}
    </div>
  );
}

/**
 * One of the store's staff portals — a cashier or a supervisor. The password is
 * set by the owner and checked by the database when that portal opens; the
 * access rules decide which screens it lands on.
 */
export default function CashierCard({ cashier, onEdit, onRemove }) {
  const initial = (cashier.full_name || "?").trim().charAt(0).toUpperCase() || "?";
  const supervisor = cashier.role === "supervisor";
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                supervisor ? "bg-indigo-100 dark:bg-indigo-900/40" : "bg-teal-100 dark:bg-teal-900/40"
              }`}
            >
              <span
                className={`text-lg font-bold ${
                  supervisor
                    ? "text-indigo-700 dark:text-indigo-300"
                    : "text-teal-700 dark:text-teal-300"
                }`}
              >
                {initial}
              </span>
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-foreground">{cashier.full_name}</h3>
              <p className="text-xs text-muted-foreground">
                <Badge variant="outline" className="mr-1 text-[10px]">{roleLabel(cashier.role)}</Badge>
                Portal {cashier.slot}
              </p>
              <Badge
                variant="outline"
                className={
                  cashier.has_password
                    ? "mt-1 gap-1 border-teal-200 text-[11px] text-teal-700 dark:border-teal-900 dark:text-teal-400"
                    : "mt-1 gap-1 text-[11px] text-muted-foreground"
                }
              >
                <KeyRound size={11} aria-hidden="true" />
                {cashier.has_password ? "Password set" : "No password yet"}
              </Badge>
            </div>
          </div>
          {onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${cashier.full_name}`}
              onClick={() => onRemove(cashier)}
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-600"
            >
              <Trash2 size={15} />
            </Button>
          )}
        </div>

        <div className="mt-2">
          <AccessChips permissions={cashier.permissions} />
        </div>

        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full gap-1.5"
          onClick={() => onEdit(cashier)}
        >
          <Edit size={14} /> Edit access
        </Button>
      </CardContent>
    </Card>
  );
}

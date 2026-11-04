import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, KeyRound } from "lucide-react";

/**
 * One of the store's three cashier portals. The password is set by the owner
 * and checked by the database when that cashier opens the till.
 */
export default function CashierCard({ cashier, onEdit }) {
  const initial = (cashier.full_name || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/40">
            <span className="text-lg font-bold text-teal-700 dark:text-teal-300">{initial}</span>
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-foreground">{cashier.full_name}</h3>
            <p className="text-xs text-muted-foreground">Till {cashier.slot}</p>
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

        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full gap-1.5"
          onClick={() => onEdit(cashier)}
        >
          <Edit size={14} /> Edit name and password
        </Button>
      </CardContent>
    </Card>
  );
}

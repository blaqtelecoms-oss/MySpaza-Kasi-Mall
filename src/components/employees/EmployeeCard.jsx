import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Mail, Trash2 } from "lucide-react";
import { MODULE_LABELS } from "@/lib/modules";

function ModuleChips({ permissions }) {
  const granted = Object.keys(permissions || {});
  if (granted.length === 0) {
    return <span className="text-xs text-muted-foreground">No modules</span>;
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

const salaryLabel = (value) =>
  value === null || value === undefined || value === ""
    ? null
    : "R " + Number(value).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " / month";

/** An employee who has accepted and can sign in to this shop. */
export function EmployeeCard({ member, onEdit, onRevoke }) {
  const displayName = member.full_name || member.member_email || "?";
  const initial = displayName.trim().charAt(0).toUpperCase();
  const salary = salaryLabel(member.monthly_salary);
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
              <span className="text-lg font-bold text-green-700 dark:text-green-400">{initial}</span>
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-foreground">{displayName}</h3>
              {member.full_name && (
                <p className="truncate text-xs text-muted-foreground">{member.member_email}</p>
              )}
              <p className="mt-1 text-xs font-medium text-foreground">
                {salary || <span className="font-normal text-muted-foreground">No salary set</span>}
              </p>
              <Badge variant="outline" className="mt-1 text-xs">{member.role}</Badge>
              <div className="mt-1.5">
                <ModuleChips permissions={member.permissions} />
              </div>
            </div>
          </div>
          <Badge className="flex shrink-0 items-center gap-1.5 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
            <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
            Active
          </Badge>
        </div>

        <div className="mt-3 flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => onEdit(member)}>
            <Edit size={14} /> Edit access
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9"
            aria-label={`Revoke access for ${member.member_email}`}
            onClick={() => onRevoke(member)}
          >
            <Trash2 size={15} className="text-red-400" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** An invitation that has been emailed but not accepted yet. */
export function PendingInviteCard({ invite, onCancel }) {
  const expires = invite.expires_at
    ? new Date(invite.expires_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })
    : null;
  return (
    <Card className="border-dashed">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-dashed border-border">
              <Mail size={18} className="text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-foreground">{invite.full_name || invite.email}</h3>
              {invite.full_name && (
                <p className="truncate text-xs text-muted-foreground">{invite.email}</p>
              )}
              <p className="mt-1 text-xs font-medium text-foreground">
                {salaryLabel(invite.monthly_salary) || (
                  <span className="font-normal text-muted-foreground">No salary set</span>
                )}
              </p>
              <Badge variant="outline" className="mt-1 text-xs">{invite.role}</Badge>
              <div className="mt-1.5">
                <ModuleChips permissions={invite.permissions} />
              </div>
            </div>
          </div>
          <Badge className="shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            Invite sent
          </Badge>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <p className="flex-1 text-xs text-muted-foreground">
            {expires ? `Link expires ${expires}` : "Waiting for them to accept"}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => onCancel(invite)}
          >
            <Trash2 size={14} /> Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Database, ShieldCheck, HardDrive } from "lucide-react";

const LABELS = {
  BASE44_APP_ID: "Base44 app id",
  BASE44_ADMIN_TOKEN: "Base44 admin token",
  SUPABASE_URL: "Supabase URL",
  SUPABASE_SERVICE_ROLE_KEY: "Service role key",
  SUPABASE_ACCESS_TOKEN: "Supabase access token",
};

export default function CredentialStatus({ credentials, source, target }) {
  const entries = Object.entries(credentials?.present || {});
  const ready = credentials?.ready;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck size={18} />
          Connection
          <Badge variant={ready ? "default" : "destructive"} className="ml-auto text-[11px]">
            {ready ? "Ready" : "Missing credentials"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {entries.map(([key, present]) => (
            <div
              key={key}
              className="flex items-center gap-2 rounded-lg bg-muted/50 dark:bg-muted/30 px-3 py-2"
            >
              {present ? (
                <CheckCircle2 size={15} className="text-green-600 shrink-0" />
              ) : (
                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
              )}
              <span className="text-xs font-medium text-foreground truncate">{LABELS[key] || key}</span>
              <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                {present ? "set" : "missing"}
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="flex items-start gap-2 rounded-lg border p-3">
            <Database size={15} className="text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-foreground">Source</p>
              <p className="text-muted-foreground break-all">
                Base44 app {source?.appId || "—"}
              </p>
              <p className="text-muted-foreground">
                {source?.entities?.length || 0} entity tables detected
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg border p-3">
            <HardDrive size={15} className="text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-foreground">Target</p>
              <p className="text-muted-foreground break-all">Project {target?.projectRef || "—"}</p>
              <p className="text-muted-foreground break-all">{target?.url || "—"}</p>
            </div>
          </div>
        </div>

        {!ready && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            Add the missing values on the secrets page. Credentials are delivered to the service at
            runtime and never stored in the repository.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

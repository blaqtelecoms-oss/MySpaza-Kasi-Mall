import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, AlertTriangle, KeyRound, CloudUpload, Users, Layers } from "lucide-react";
import { formatBytes, formatNumber } from "./format";

export default function RunReport({ report }) {
  if (!report || report.kind !== "apply") return null;

  const tables = report.tables || [];
  const reconciliation = report.reconciliation || { tables: [], users: {}, clean: false };
  const users = report.users || {};
  const media = report.media || null;
  const failures = report.failures || [];

  const written = tables.reduce((sum, table) => sum + table.written, 0);
  const skipped = tables.reduce((sum, table) => sum + table.skipped, 0);
  const failedRows = tables.reduce((sum, table) => sum + table.failed, 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-xl border p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Layers size={14} />
            <span className="text-[11px] font-medium uppercase tracking-wide">Records written</span>
          </div>
          <p className="text-xl font-bold text-foreground mt-1">{formatNumber(written)}</p>
          <p className="text-[11px] text-muted-foreground">{formatNumber(skipped)} already existed</p>
        </div>
        <div className="rounded-xl border p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users size={14} />
            <span className="text-[11px] font-medium uppercase tracking-wide">Accounts</span>
          </div>
          <p className="text-xl font-bold text-foreground mt-1">{formatNumber(users.created)}</p>
          <p className="text-[11px] text-muted-foreground">{formatNumber(users.skipped)} already existed</p>
        </div>
        <div className="rounded-xl border p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CloudUpload size={14} />
            <span className="text-[11px] font-medium uppercase tracking-wide">Media uploaded</span>
          </div>
          <p className="text-xl font-bold text-foreground mt-1">{formatNumber(media?.uploaded)}</p>
          <p className="text-[11px] text-muted-foreground">{formatBytes(media?.bytes)} transferred</p>
        </div>
        <div className="rounded-xl border p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            {reconciliation.clean ? (
              <CheckCircle2 size={14} className="text-green-600" />
            ) : (
              <AlertTriangle size={14} className="text-amber-600" />
            )}
            <span className="text-[11px] font-medium uppercase tracking-wide">Reconciliation</span>
          </div>
          <p className="text-xl font-bold text-foreground mt-1">
            {reconciliation.clean ? "Clean" : "Needs attention"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {reconciliation.tablesWithGaps || 0} table(s) with gaps · {formatNumber(failedRows)} row error(s)
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Rows per table</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Entity</TableHead>
                  <TableHead className="text-xs text-right">Source</TableHead>
                  <TableHead className="text-xs text-right">Written</TableHead>
                  <TableHead className="text-xs text-right">Skipped</TableHead>
                  <TableHead className="text-xs text-right">Failed</TableHead>
                  <TableHead className="text-xs text-right">Missing at target</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.map((table) => {
                  const check = reconciliation.tables?.find((entry) => entry.table === table.table);
                  return (
                    <TableRow key={table.table}>
                      <TableCell className="text-xs font-medium text-foreground">{table.entity}</TableCell>
                      <TableCell className="text-xs text-right">{formatNumber(table.sourceRows)}</TableCell>
                      <TableCell className="text-xs text-right">{formatNumber(table.written)}</TableCell>
                      <TableCell className="text-xs text-right">{formatNumber(table.skipped)}</TableCell>
                      <TableCell className="text-xs text-right">
                        {table.failed ? (
                          <span className="text-red-600 font-medium">{table.failed}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        {check?.missingCount ? (
                          <Badge variant="destructive" className="text-[10px]">{check.missingCount}</Badge>
                        ) : (
                          <CheckCircle2 size={13} className="inline text-green-600" />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><CloudUpload size={15} /> Storage buckets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(media?.buckets || []).map((bucket) => (
              <div key={bucket.id} className="rounded-lg border p-2.5">
                <p className="text-xs font-semibold text-foreground">
                  {bucket.id}
                  <Badge variant="outline" className="ml-2 text-[10px] font-normal">
                    {bucket.public ? "public" : "private"}
                  </Badge>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatNumber(bucket.uploaded)} uploaded · {formatNumber(bucket.skipped)} already present ·{" "}
                  {formatNumber(bucket.failed)} failed · {formatBytes(bucket.bytes)}
                </p>
              </div>
            ))}
            {!media && <p className="text-xs text-muted-foreground">No media phase results.</p>}
            {media && (
              <p className="text-[11px] text-muted-foreground">
                {formatNumber(media.referencesUpdated)} record reference(s) repointed at Supabase Storage.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Users size={15} /> Accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              {formatNumber(users.source)} source · {formatNumber(users.created)} created ·{" "}
              {formatNumber(users.skipped)} existed · {formatNumber(users.failed)} failed
            </p>
            <p className="text-[11px] text-muted-foreground">
              Profiles in target: {formatNumber(reconciliation.users?.migrated)} of{" "}
              {formatNumber(reconciliation.users?.source)}
            </p>
            {users.requiresPasswordReset > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 mt-2">
                <KeyRound size={13} className="text-amber-700 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-800">
                  {users.requiresPasswordReset} account(s) were created without a password. Base44 password
                  hashes cannot be transferred, so each user must reset their password before signing in.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {failures.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-600" />
              Issues ({failures.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 max-h-64 overflow-y-auto">
            {failures.map((failure, index) => (
              <p key={`${failure.scope}-${failure.key}-${index}`} className="text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{failure.scope}</span> · {failure.key} —{" "}
                {failure.message}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

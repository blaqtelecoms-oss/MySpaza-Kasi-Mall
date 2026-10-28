import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, FolderOpen, Users, ImageIcon, Layers } from "lucide-react";
import { formatNumber } from "./format";

function Stat({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon size={14} />
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl font-bold text-foreground mt-1">{formatNumber(value)}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function InventorySummary({ report }) {
  const inventory = report?.inventory;
  if (!inventory) return null;

  const { source, target, tables = [], warnings = [] } = inventory;
  const bucketPlan = report?.bucketPlan || [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat icon={Layers} label="Tables" value={source.entities} hint={`${formatNumber(source.records)} records in source`} />
        <Stat icon={Users} label="Accounts" value={source.users} hint={`${target.authUsers} already in Supabase`} />
        <Stat icon={ImageIcon} label="Media files" value={source.mediaReferences} hint={`${bucketPlan.length} buckets planned`} />
        <Stat
          icon={FolderOpen}
          label="Target rows"
          value={tables.reduce((sum, table) => sum + table.targetRows, 0)}
          hint={`${target.existingTables} tables already exist`}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">What will be copied</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Source entity</TableHead>
                  <TableHead className="text-xs">Target table</TableHead>
                  <TableHead className="text-xs text-right">Records</TableHead>
                  <TableHead className="text-xs text-right">Media</TableHead>
                  <TableHead className="text-xs text-right">In target</TableHead>
                  <TableHead className="text-xs text-right">Overlap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.map((table) => (
                  <TableRow key={table.entity}>
                    <TableCell className="text-xs font-medium text-foreground">{table.entity}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{table.table}</TableCell>
                    <TableCell className="text-xs text-right">{formatNumber(table.sourceRows)}</TableCell>
                    <TableCell className="text-xs text-right">{formatNumber(table.mediaReferences)}</TableCell>
                    <TableCell className="text-xs text-right">{formatNumber(table.targetRows)}</TableCell>
                    <TableCell className="text-xs text-right">
                      {table.overlappingRows ? (
                        <Badge variant="secondary" className="text-[10px]">{table.overlappingRows}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Storage buckets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {bucketPlan.map((bucket) => (
            <div key={bucket.id} className="flex items-start gap-2 rounded-lg border p-3">
              <FolderOpen size={15} className="text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground">
                  {bucket.id}
                  <Badge variant="outline" className="ml-2 text-[10px] font-normal">
                    {bucket.public ? "public" : "private"}
                  </Badge>
                  {bucket.exists && (
                    <Badge variant="secondary" className="ml-1 text-[10px] font-normal">exists</Badge>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground">{bucket.description}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{formatNumber(bucket.referencedMedia)} files</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1.5">
          {warnings.map((warning) => (
            <p key={warning} className="text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>{warning}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

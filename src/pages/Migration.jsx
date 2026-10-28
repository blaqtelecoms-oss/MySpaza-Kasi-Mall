import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Database, Loader2, Play, RefreshCw, RotateCcw, ShieldAlert, Sparkles, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { migrationApi, MigrationApiError } from "@/api/migrationClient";
import CredentialStatus from "@/components/migration/CredentialStatus";
import InventorySummary from "@/components/migration/InventorySummary";
import RunTimeline from "@/components/migration/RunTimeline";
import RunReport from "@/components/migration/RunReport";
import { formatRunTime } from "@/components/migration/format";

const ACTIVE_STATUSES = ["queued", "running"];

const CONFLICT_OPTIONS = [
  {
    value: "skip",
    title: "Keep existing rows",
    description: "Rows whose id already exists in Supabase are left untouched. Safest for a first run.",
  },
  {
    value: "overwrite",
    title: "Overwrite existing rows",
    description: "Rows that already exist are replaced with the Base44 version.",
  },
];

export default function Migration() {
  const [status, setStatus] = useState(null);
  const [serviceError, setServiceError] = useState(null);
  const [run, setRun] = useState(null);
  const [dryRun, setDryRun] = useState(null);
  const [conflictMode, setConflictMode] = useState("skip");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const dryRunLoaded = useRef(false);
  const { toast } = useToast();

  const describeError = (error) =>
    error instanceof MigrationApiError && error.status === 403
      ? "This screen is available to administrators only."
      : error.message;

  const loadStatus = useCallback(async () => {
    try {
      const data = await migrationApi.status();
      setStatus(data);
      setServiceError(null);
      return data;
    } catch (error) {
      setServiceError(error);
      return null;
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Re-open the most recent completed dry run so "Start migration" survives a reload.
  useEffect(() => {
    if (!status || dryRunLoaded.current) return;
    const previous = status.runs?.find((entry) => entry.mode === "dry-run" && entry.status === "completed");
    if (!previous) return;
    dryRunLoaded.current = true;
    migrationApi
      .getRun(previous.id)
      .then((response) => setDryRun(response.run))
      .catch(() => {});
  }, [status]);

  // Poll the active run until it reaches a terminal state.
  useEffect(() => {
    if (!run || !ACTIVE_STATUSES.includes(run.status)) return;
    const timer = setInterval(async () => {
      try {
        const response = await migrationApi.getRun(run.id);
        setRun(response.run);
        if (!ACTIVE_STATUSES.includes(response.run.status)) {
          if (response.run.mode === "dry-run" && response.run.status === "completed") {
            setDryRun(response.run);
            toast({ title: "Dry run complete", description: "Review the inventory, then start the migration." });
          }
          if (response.run.mode === "apply") {
            const failed = response.run.status === "failed";
            toast({
              title: failed ? "Migration stopped" : "Migration finished",
              description: failed ? response.run.error : "Open the report for the reconciliation summary.",
              variant: failed ? "destructive" : undefined,
            });
          }
          loadStatus();
        }
      } catch (error) {
        clearInterval(timer);
        toast({ title: "Lost connection to the migration service", description: describeError(error), variant: "destructive" });
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [run, loadStatus, toast]);

  const startDryRun = async () => {
    setBusy(true);
    try {
      const response = await migrationApi.dryRun();
      setRun(response.run);
    } catch (error) {
      toast({ title: "Could not start dry run", description: describeError(error), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const startMigration = async () => {
    setConfirmOpen(false);
    setBusy(true);
    try {
      const response = await migrationApi.startRun({ conflictMode });
      setRun(response.run);
    } catch (error) {
      toast({ title: "Could not start migration", description: describeError(error), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const retryRun = async (id) => {
    setBusy(true);
    try {
      const response = await migrationApi.retry(id);
      setRun(response.run);
    } catch (error) {
      toast({ title: "Could not resume migration", description: describeError(error), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (serviceError) {
    return (
      <div className="p-4 max-w-3xl mx-auto space-y-4">
        <BackLink />
        <Card>
          <CardContent className="p-6 text-center space-y-2">
            <ShieldAlert size={28} className="mx-auto text-amber-600" />
            <p className="text-sm font-semibold text-foreground">
              {serviceError.status === 403 ? "Administrator access required" : "Migration service unavailable"}
            </p>
            <p className="text-xs text-muted-foreground">{describeError(serviceError)}</p>
            <Button variant="outline" size="sm" onClick={loadStatus} className="mt-2">
              <RefreshCw size={14} className="mr-1.5" /> Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-green-600" />
      </div>
    );
  }

  const running = run && ACTIVE_STATUSES.includes(run.status);
  const dryRunReady = dryRun?.status === "completed";
  const applyRun = run?.mode === "apply" ? run : null;
  const recentRuns = status.runs || [];

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <BackLink />
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Database size={22} /> Supabase migration
        </h1>
        <p className="text-muted-foreground text-sm">
          Move this app&apos;s tables, records, media and user accounts from Base44 into your Supabase project.
        </p>
      </div>

      <CredentialStatus
        credentials={status.credentials}
        source={status.source}
        target={status.target}
      />

      {!status.credentials?.ready ? null : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles size={18} /> 1 · Dry run
                {dryRunReady && <Badge variant="secondary" className="ml-auto text-[11px]">Inventory ready</Badge>}
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">
                Reads the Base44 app and inspects the Supabase project. Nothing is written.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={startDryRun} disabled={busy || running} variant="outline" className="w-full sm:w-auto">
                {busy && !run ? <Loader2 size={15} className="mr-1.5 animate-spin" /> : <Play size={15} className="mr-1.5" />}
                Run dry run
              </Button>

              {run?.mode === "dry-run" && <RunTimeline run={run} />}
              {dryRunReady && <InventorySummary report={dryRun.report} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Database size={18} /> 2 · Start migration
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">
                Creates the tables and buckets, copies accounts, records and media files, then reconciles.
                Re-running is safe: finished work is skipped, not duplicated.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {CONFLICT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setConflictMode(option.value)}
                    className={`w-full text-left rounded-xl border p-3 transition-colors ${
                      conflictMode === option.value
                        ? "border-green-600 bg-green-50 dark:bg-green-950/30"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <p className="text-xs font-semibold text-foreground">{option.title}</p>
                    <p className="text-[11px] text-muted-foreground">{option.description}</p>
                  </button>
                ))}
              </div>

              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={!dryRunReady || busy || running}
                className="w-full sm:w-auto"
              >
                <ArrowRight size={15} className="mr-1.5" />
                Start migration
              </Button>
              {!dryRunReady && (
                <p className="text-[11px] text-muted-foreground">Run the dry run first to unlock this step.</p>
              )}

              {applyRun && (
                <div className="space-y-3 pt-1">
                  <RunTimeline run={applyRun} />
                  {applyRun.status === "completed" || applyRun.status === "completed_with_errors" ? (
                    <RunReport report={applyRun.report} />
                  ) : null}
                  {(applyRun.status === "failed" || applyRun.status === "interrupted") && (
                    <Button variant="outline" onClick={() => retryRun(applyRun.id)} disabled={busy}>
                      <RotateCcw size={15} className="mr-1.5" /> Resume from last unfinished step
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {recentRuns.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentRuns.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => migrationApi.getRun(entry.id).then((response) => setRun(response.run)).catch(() => {})}
                className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 text-left"
              >
                <Badge variant={entry.mode === "dry-run" ? "outline" : "secondary"} className="text-[10px]">
                  {entry.mode === "dry-run" ? "Dry run" : "Apply"}
                </Badge>
                <span className="text-xs text-foreground">{entry.status.replaceAll("_", " ")}</span>
                <span className="text-[11px] text-muted-foreground ml-auto">{formatRunTime(entry.startedAt || entry.createdAt)}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start the migration now?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  This writes to Supabase project <span className="font-semibold">{status.target.projectRef}</span>:
                  it creates tables and storage buckets, then copies records, media files and user accounts.
                </p>
                <p>
                  Conflict mode is <span className="font-semibold">{conflictMode === "overwrite" ? "overwrite existing rows" : "keep existing rows"}</span>.
                </p>
                <p>
                  Accounts are recreated without passwords, so each user must reset their password before
                  signing in.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={startMigration}>Start migration</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/settings" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
      <ArrowLeft size={14} /> Back to settings
    </Link>
  );
}

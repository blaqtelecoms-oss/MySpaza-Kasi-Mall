import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, Circle, Clock } from "lucide-react";
import { PHASE_LABELS, formatNumber, formatRunTime } from "./format";

const ICONS = {
  completed: <CheckCircle2 size={16} className="text-green-600" />,
  running: <Loader2 size={16} className="text-green-700 animate-spin" />,
  failed: <XCircle size={16} className="text-red-600" />,
  pending: <Circle size={16} className="text-muted-foreground/40" />,
};

const STATUS_LABELS = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  completed_with_errors: "Completed with warnings",
  failed: "Failed",
  interrupted: "Interrupted",
};

export default function RunTimeline({ run }) {
  if (!run) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock size={18} />
          {run.mode === "dry-run" ? "Dry run" : "Migration"}
          <Badge
            variant={run.status === "failed" ? "destructive" : run.status === "running" ? "default" : "secondary"}
            className="ml-auto text-[11px]"
          >
            {STATUS_LABELS[run.status] || run.status}
          </Badge>
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Started {formatRunTime(run.startedAt)} · conflict mode {run.conflictMode}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {run.phases.map((phase) => {
          const progress = phase.progress;
          const percent =
            progress && progress.total ? Math.round((progress.done / progress.total) * 100) : null;
          return (
            <div key={phase.name} className="space-y-1">
              <div className="flex items-center gap-2">
                {ICONS[phase.status] || ICONS.pending}
                <span className="text-xs font-medium text-foreground">
                  {PHASE_LABELS[phase.name] || phase.name}
                </span>
                <span className="text-[11px] text-muted-foreground ml-auto">
                  {progress
                    ? `${formatNumber(progress.done)} / ${formatNumber(progress.total)} ${progress.unit || ""}`
                    : phase.status}
                </span>
              </div>
              {phase.status === "running" && percent !== null && (
                <Progress value={percent} className="h-1.5" />
              )}
              {phase.error && <p className="text-[11px] text-red-600 pl-6">{phase.error}</p>}
            </div>
          );
        })}

        {run.error && run.status === "failed" && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{run.error}</p>
        )}
      </CardContent>
    </Card>
  );
}

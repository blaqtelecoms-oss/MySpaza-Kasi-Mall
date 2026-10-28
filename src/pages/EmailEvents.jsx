import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Mail, RefreshCw, Search, ShieldAlert, MailCheck, MailWarning, Send } from "lucide-react";
import { useEntityQuery } from "@/hooks/useEntityQuery";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// Resend event types arrive as "email.delivered" etc.; our own send records use
// "submitted". The label and colour are all the operator needs to read the log.
const EVENT_STYLES = {
  submitted: { label: "Sent to Resend", className: "bg-slate-100 text-slate-700 border-slate-200" },
  "email.sent": { label: "Sent", className: "bg-slate-100 text-slate-700 border-slate-200" },
  "email.delivered": { label: "Delivered", className: "bg-green-100 text-green-800 border-green-200" },
  "email.opened": { label: "Opened", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  "email.clicked": { label: "Clicked", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  "email.delivery_delayed": { label: "Delayed", className: "bg-amber-100 text-amber-800 border-amber-200" },
  "email.bounced": { label: "Bounced", className: "bg-red-100 text-red-800 border-red-200" },
  "email.complained": { label: "Complaint", className: "bg-red-100 text-red-800 border-red-200" },
  "email.failed": { label: "Failed", className: "bg-red-100 text-red-800 border-red-200" },
  "email.suppressed": { label: "Suppressed", className: "bg-red-100 text-red-800 border-red-200" },
};

const eventStyle = (type) =>
  EVENT_STYLES[type] || {
    label: type || "Event",
    className: "bg-muted text-muted-foreground border-border",
  };

const formatWhen = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const shortId = (value) => (value ? `${String(value).slice(0, 12)}…` : "—");

export default function EmailEvents() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const isAdmin = user?.role === "admin";

  const eventsQuery = useEntityQuery("EmailEvent", "list", ["-created_date", 300], {
    enabled: isAdmin,
  });

  const events = eventsQuery.data || [];

  const stats = useMemo(() => {
    const count = (type) => events.filter((event) => event.event_type === type).length;
    return {
      submitted: events.filter((event) => event.event_type === "submitted" || event.event_type === "email.sent").length,
      delivered: count("email.delivered"),
      bounced: count("email.bounced") + count("email.failed") + count("email.suppressed"),
      complaints: count("email.complained"),
    };
  }, [events]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return events;
    return events.filter((event) =>
      [event.recipient_email, event.subject, event.template, event.event_type, event.resend_email_id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [events, search]);

  if (!isAdmin) {
    return (
      <div className="p-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert size={18} /> Email log
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Only an operator with the <span className="font-medium text-foreground">admin</span> role can
            read the email log.
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = [
    { label: "Sent", value: stats.submitted, icon: Send },
    { label: "Delivered", value: stats.delivered, icon: MailCheck },
    { label: "Bounced / failed", value: stats.bounced, icon: MailWarning },
    { label: "Complaints", value: stats.complaints, icon: ShieldAlert },
  ];

  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Mail size={20} /> Email log
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Delivery events Resend reports for signup codes and account emails.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => eventsQuery.refetch()} aria-label="Refresh email log">
          <RefreshCw size={18} className={eventsQuery.isFetching ? "animate-spin" : ""} />
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summary.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon size={16} />
                <span className="text-xs font-medium">{label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by recipient, subject or event"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {eventsQuery.isLoading && !eventsQuery.data ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading email events…</p>
          ) : eventsQuery.error ? (
            <p className="px-4 py-8 text-center text-sm text-destructive">
              Could not load the email log: {eventsQuery.error.message}
            </p>
          ) : visible.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {events.length === 0
                ? "No email events yet. Send a signup verification email to see it here."
                : "No events match that filter."}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {visible.map((event) => {
                const style = eventStyle(event.event_type);
                return (
                  <div key={event.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-[11px] ${style.className}`}>
                          {style.label}
                        </Badge>
                        <span className="text-sm font-medium text-foreground truncate">
                          {event.recipient_email || "Unknown recipient"}
                        </span>
                        {event.template && (
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {event.template}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {event.subject || "No subject"} · <span className="font-mono">{shortId(event.resend_email_id)}</span>
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground sm:text-right shrink-0">
                      {formatWhen(event.event_created_at || event.created_date)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

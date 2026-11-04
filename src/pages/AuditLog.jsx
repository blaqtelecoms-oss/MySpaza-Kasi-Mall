import { useMemo, useState } from "react";
import {
  ScrollText, RefreshCw, Search, LogIn, LogOut, DoorOpen, MousePointerClick,
  Database, ShieldCheck, Users, Receipt,
} from "lucide-react";
import { useEntityQuery } from "@/hooks/useEntityQuery";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// How a row reads at a glance: the icon says what kind of event it was, the
// badge colour says which part of the store it belongs to.
const CATEGORY_STYLES = {
  auth: { label: "Sign-in", className: "bg-green-100 text-green-800 border-green-200", icon: LogIn },
  portal: { label: "Portal", className: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: DoorOpen },
  page: { label: "Page", className: "bg-slate-100 text-slate-700 border-slate-200", icon: MousePointerClick },
  data: { label: "Change", className: "bg-amber-100 text-amber-900 border-amber-200", icon: Database },
};

const FILTERS = [
  { key: "all", label: "Everything" },
  { key: "auth", label: "Sign-ins" },
  { key: "portal", label: "Portals" },
  { key: "page", label: "Pages" },
  { key: "data", label: "Changes" },
];

const ACTION_ICONS = { sign_in: LogIn, sign_out: LogOut, portal_open: DoorOpen, portal_close: DoorOpen };

const categoryStyle = (category) =>
  CATEGORY_STYLES[category] || {
    label: category || "Event",
    className: "bg-muted text-muted-foreground border-border",
    icon: ShieldCheck,
  };

const iconFor = (event) =>
  ACTION_ICONS[event.action] ||
  (event.entity === "sale" ? Receipt : event.action === "insert" ? Database : categoryStyle(event.category).icon);

const timeLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
};

const dayLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown day";
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

/** "Opened Point of Sale" · "Added product: Bread" — the summary the database wrote. */
const eventTitle = (event) =>
  event.summary || `${categoryStyle(event.category).label} · ${event.action}`;

/**
 * The store's activity log: who signed in or out, which portal they opened,
 * every page they visited and every record they added, changed or deleted.
 * Owner-only — the log rows are only readable by the shop's owner.
 */
export default function AuditLog() {
  const { shop } = useAuth();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const eventsQuery = useEntityQuery("AuditLog", "list", ["-created_date", 400], {
    enabled: Boolean(shop?.shopId),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const events = eventsQuery.data || [];

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return events.filter((event) => {
      if (filter !== "all" && event.category !== filter) return false;
      if (!term) return true;
      return [event.actor_name, event.actor_role, event.summary, event.module, event.path, event.entity, event.action]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [events, filter, search]);

  // One heading per day keeps a long log readable.
  const groups = useMemo(() => {
    const map = new Map();
    for (const event of visible) {
      const key = new Date(event.created_date).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(event);
    }
    return [...map.entries()].map(([key, rows]) => ({ key, label: dayLabel(rows[0].created_date), rows }));
  }, [visible]);

  const counts = useMemo(() => {
    const base = { all: events.length };
    for (const event of events) base[event.category] = (base[event.category] || 0) + 1;
    return base;
  }, [events]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 pb-24">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <ScrollText size={22} /> Audit log
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything that happens in {shop?.shopName || "this shop"}, and who did it.
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => eventsQuery.refetch()}
          aria-label="Refresh audit log"
        >
          <RefreshCw size={18} className={eventsQuery.isFetching ? "animate-spin" : ""} />
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setFilter(option.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === option.key
                ? "border-transparent bg-[#0D0D0D] text-white"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.label}
            <span className={`ml-1.5 ${filter === option.key ? "text-white/60" : "text-muted-foreground/70"}`}>
              {counts[option.key] || 0}
            </span>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by person, screen or record"
          className="pl-9"
        />
      </div>

      {eventsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading the activity log…</p>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <Users size={22} className="text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Nothing recorded yet</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {events.length === 0
                ? "Sign-ins, portal opens, page visits and record changes show up here as soon as they happen."
                : "No entries match this filter."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.key} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </h2>
              <Card>
                <CardContent className="divide-y divide-border p-0">
                  {group.rows.map((event) => {
                    const style = categoryStyle(event.category);
                    const Icon = iconFor(event);
                    return (
                      <div key={event.id} className="flex items-start gap-3 px-3 py-2.5">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Icon size={15} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground">{eventTitle(event)}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground/80">{event.actor_name || "Unknown"}</span>
                            {event.actor_role && <span>· {event.actor_role}</span>}
                            {event.portal && event.portal !== "owner" && (
                              <span className="capitalize">· {event.portal} portal</span>
                            )}
                            {event.path && <span>· {event.path}</span>}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-xs text-muted-foreground">{timeLabel(event.created_date)}</span>
                          <Badge variant="outline" className={`text-[10px] ${style.className}`}>
                            {style.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

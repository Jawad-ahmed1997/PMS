import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/layout/PageHeader";
import PlaceholderUpload from "@/components/ui/PlaceholderUpload";
import AnalyticsDashboardPanel from "@/components/analytics/AnalyticsDashboardPanel";
import { getSession } from "@/lib/session-server";
import { getRoleById, roles } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { Activity, CheckCircle2, CircleAlert, Clock3, Gauge, ListChecks, TrendingDown, TrendingUp } from "lucide-react";
import { getTodayInPSTDateString } from "@/lib/pstDate";

const metricDefinitions = [
  {
    id: "tasks-completed",
    label: "Tasks completed",
    value: "128",
    trend: "+12% WoW",
    detail: "92% delivered on time",
  },
  {
    id: "rework-count",
    label: "Rework count",
    value: "9",
    trend: "-3 vs last week",
    detail: "Quality improvements holding",
  },
  {
    id: "time-vs-estimate",
    label: "Time vs estimate",
    value: "1.06x",
    trend: "Near target",
    detail: "Estimate accuracy stable",
  },
  {
    id: "checklist-compliance",
    label: "Checklist compliance",
    value: "96%",
    trend: "+2% WoW",
    detail: "QA gates consistently met",
  },
  {
    id: "blocked-tasks",
    label: "Blocked tasks",
    value: "4",
    trend: "-2 vs last week",
    detail: "Dependencies clearing",
  },
  {
    id: "milestone-health",
    label: "Milestone health",
    value: "Green",
    trend: "3 at risk",
    detail: "Next milestone in 12 days",
  },
];

const executiveHighlights = [
  {
    title: "Portfolio confidence",
    value: "High",
    detail: "3 critical programs in steady state",
  },
  {
    title: "Delivery cadence",
    value: "12 teams weekly",
    detail: "Cross-org updates on schedule",
  },
  {
    title: "Resource focus",
    value: "78% allocated",
    detail: "Hiring plan aligned to milestones",
  },
];

const deliveryFocus = [
  {
    title: "Active releases",
    value: "6",
    detail: "2 major launches this quarter",
  },
  {
    title: "Escalations",
    value: "2",
    detail: "Pending vendor review",
  },
  {
    title: "Cross-team blockers",
    value: "4",
    detail: "Infrastructure dependencies",
  },
];

const developerSnapshot = [
  {
    title: "My tasks completed",
    value: "14",
    detail: "5 ahead of plan",
  },
  {
    title: "My rework items",
    value: "1",
    detail: "Reviewed and cleared",
  },
  {
    title: "My time vs estimate",
    value: "0.98x",
    detail: "Staying within scope",
  },
  {
    title: "My checklist compliance",
    value: "100%",
    detail: "All QA gates complete",
  },
  {
    title: "My blocked tasks",
    value: "1",
    detail: "Waiting on API review",
  },
  {
    title: "My milestone impact",
    value: "On track",
    detail: "Release ready in 5 days",
  },
];

const metricIcons = {
  "Tasks completed": CheckCircle2,
  "Rework count": TrendingDown,
  "Time vs estimate": Clock3,
  "Checklist compliance": ListChecks,
  "Blocked tasks": CircleAlert,
  "Milestone health": Gauge,
};

function SectionHeading({ title, description, action }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

function MetricCard({ item, compact = false, index = 0 }) {
  const Icon = metricIcons[item.label] ?? Activity;
  const isPositive = item.trend?.startsWith("+") || item.trend === "Green" || item.trend === "Near target";
  const isNegative = item.trend?.startsWith("-") || item.trend?.includes("risk");
  
  const borderClass = isPositive 
    ? "group-hover:border-emerald-500/50 group-hover:shadow-[0_8px_30px_-12px_rgba(16,185,129,0.5)]" 
    : isNegative 
      ? "group-hover:border-rose-500/50 group-hover:shadow-[0_8px_30px_-12px_rgba(244,63,94,0.5)]" 
      : "group-hover:border-primary/50 group-hover:shadow-lg";

  return (
    <Card 
      style={{ animationDelay: `${index * 50}ms` }}
      className={`group relative overflow-hidden shadow-none transition-all duration-300 hover:-translate-y-1 bg-card animate-in fade-in slide-in-from-bottom-4 fill-mode-both border-border/60 ${borderClass}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <CardContent className={`relative z-10 ${compact ? "p-4" : "p-5"}`}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">{item.label ?? item.title}</p>
          <div className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${isPositive ? "bg-emerald-500/10 text-emerald-500" : isNegative ? "bg-rose-500/10 text-rose-500" : "bg-primary/10 text-primary"}`}>
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          </div>
        </div>
        <p className={`${compact ? "mt-4 text-2xl" : "mt-6 text-3xl"} font-bold tracking-tight text-foreground`}>{item.value}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium">
          {item.trend && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${isPositive ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : isNegative ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : "bg-primary/15 text-primary"}`}>
              {item.trend}
            </span>
          )}
          <span className="text-muted-foreground">{item.detail}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function InsightCard({ item, index }) {
  return <MetricCard item={{ ...item, label: item.title }} compact index={index} />;
}

export default async function DashboardPage() {
  const session = await getSession();
  const role = getRoleById(session?.role);
  const roleId = role?.id ?? null;

  const hasDatabase = Boolean(process.env.DATABASE_URL);
  let currentUser = null;
  let users = [];

  if (hasDatabase && session?.email) {
    currentUser = await prisma.user.findUnique({
      where: { email: session.email },
      select: { id: true, name: true, email: true, role: true },
    });
    if (currentUser) {
      users = await prisma.user.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true, role: true },
      });
    }
  }

  const isExecutiveSummary = roleId === roles.CEO || !roleId;
  const isFullVisibility =
    roleId === roles.PM ||
    roleId === roles.CTO ||
    roleId === roles.TEAM_LEAD;
  const isDeveloper =
    roleId === roles.DEV ||
    roleId === roles.SENIOR_DEV ||
    roleId === roles.INTERN ||
    roleId === roles.JUNIOR_INTERN;

  const headline = isFullVisibility
    ? {
        title: "Program delivery command center",
        description: "Full visibility across initiatives, dependencies, and QA.",
      }
    : isDeveloper
    ? {
        title: "My delivery dashboard",
        description: "Personal execution insights with milestone impact.",
      }
    : {
        title: "Executive overview",
        description: "Summary visibility across programs and resources.",
      };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <PageHeader
        eyebrow="Dashboard"
        title={headline.title}
        subtitle={headline.description}
        actions={
          <Button
            label={isDeveloper ? "Share update" : "Share snapshot"}
            variant="primary"
            toast={{
              title: "Snapshot ready",
              message:
                "Role-based dashboard snapshots are ready for email delivery.",
              variant: "info",
            }}
          />
        }
      />

      <section className="space-y-4" aria-labelledby="working-time-analytics">
        <SectionHeading
          title="Working time analytics"
          description="Understand work, break, idle, and utilization patterns."
        />
        <AnalyticsDashboardPanel
          users={users}
          currentUser={currentUser}
          isManager={isFullVisibility || isExecutiveSummary}
          todayPST={getTodayInPSTDateString()}
        />
      </section>

      {isExecutiveSummary && (
        <section className="space-y-5" aria-labelledby="executive-highlights">
          <SectionHeading title="Executive highlights" description="A concise view of delivery confidence and organizational focus." />
          <div className="grid gap-6 lg:grid-cols-3">
            {executiveHighlights.map((item, index) => <InsightCard key={item.title} item={item} index={index} />)}
          </div>

          <Card>
            <CardHeader className="p-5 pb-0"><CardTitle className="text-base">Key metrics</CardTitle><CardDescription>Core delivery indicators for the current operating view.</CardDescription></CardHeader>
            <CardContent className="p-5"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{metricDefinitions.map((metric, index) => <MetricCard key={metric.id} item={metric} index={index} />)}</div></CardContent>
          </Card>
        </section>
      )}

      {isFullVisibility && (
        <section className="space-y-5" aria-labelledby="delivery-performance">
          <SectionHeading title="Delivery performance" description="Metrics and readiness signals across active programs." />
          <Card>
            <CardHeader className="p-5 pb-0"><CardTitle className="text-base">Metrics performance</CardTitle><CardDescription>Track movement against delivery targets.</CardDescription></CardHeader>
            <CardContent className="p-5"><div className="grid gap-4 lg:grid-cols-3">{metricDefinitions.map((metric, index) => <MetricCard key={metric.id} item={metric} index={index} />)}</div></CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">{deliveryFocus.map((item, index) => <InsightCard key={item.title} item={item} index={index} />)}</div>

          <Card>
            <CardHeader className="p-5 pb-0"><CardTitle className="text-base">Milestone readiness</CardTitle><CardDescription>Signals that inform the next delivery decisions.</CardDescription></CardHeader>
            <CardContent className="p-5"><div className="grid gap-4 md:grid-cols-2">
              {[
                {
                  title: "Q3 launch readiness",
                  detail: "85% complete, 4 risks logged",
                },
                {
                  title: "Dependency coverage",
                  detail: "7 of 9 partners confirmed",
                },
                {
                  title: "Checklist compliance",
                  detail: "QA gates passing across all streams",
                },
                {
                  title: "Blocked task recovery",
                  detail: "Two blockers escalated and tracked",
                },
              ].map((item) => (
                <Card key={item.title} className="bg-muted/40 shadow-none"><CardContent className="p-4"><p className="text-sm font-semibold text-foreground">{item.title}</p><p className="mt-2 text-xs text-muted-foreground">{item.detail}</p></CardContent></Card>
              ))}
            </div></CardContent>
          </Card>
        </section>
      )}

      {/* {isDeveloper && (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Individual performance
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your execution metrics across active tasks and milestones.
              </p>
            </div>
            <Button
              label="Email my status"
              size="sm"
              variant="secondary"
              toast={{
                title: "Status queued",
                message: "Your dashboard summary is formatted for email.",
                variant: "info",
              }}
            />
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{developerSnapshot.map((item, index) => <InsightCard key={item.title} item={item} index={index} />)}</div>
        </div>
        </section>
      )} */}

      {/* <PlaceholderUpload
        label={isDeveloper ? "Personal highlights" : "Quarterly highlights"}
        helperText={
          isDeveloper
            ? "Upload demos and metrics to include in your status emails."
            : "Upload leadership-ready visuals and decks."
        }
      /> */}
    </div>
  );
}

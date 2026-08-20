import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/layout/PageHeader";
import PlaceholderUpload from "@/components/ui/PlaceholderUpload";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session-server";
import { isAdminRole, normalizeRole } from "@/lib/api";
import ReportingDashboard from "@/components/reports/ReportingDashboard";

const reports = [
  {
    title: "Daily delivery pulse",
    cadence: "Every weekday at 7:00 AM",
    audience: "PM, CTO, Engineering leads",
    delivery: "Auto-generated, email-ready",
    sections: [
      "Tasks completed",
      "Blocked tasks",
      "Time vs estimate",
      "Checklist compliance",
    ],
  },
  {
    title: "Weekly executive summary",
    cadence: "Every Monday at 8:00 AM",
    audience: "CEO, PM, CTO",
    delivery: "Auto-generated, email-ready",
    sections: [
      "Milestone health",
      "Tasks completed",
      "Rework count",
      "Blocked tasks",
    ],
  },
  {
    title: "Weekly delivery health",
    cadence: "Every Friday at 4:00 PM",
    audience: "PM, CTO, Senior developers",
    delivery: "Auto-generated, email-ready",
    sections: [
      "Checklist compliance",
      "Time vs estimate",
      "Rework count",
      "Milestone health",
    ],
  },
];

const emailPreview = {
  subject: "Weekly Executive Summary | PMS Cloud",
  greeting: "Hello leadership team,",
  summary:
    "This week closed with strong delivery momentum across core initiatives.",
  highlights: [
    "12 projects reported progress with 92% on-time completion.",
    "Rework held to 9 items while checklist compliance reached 96%.",
    "3 milestones flagged for follow-up, with no critical blockers.",
  ],
  footer: "Reply to this email to request deeper analysis or adjustments.",
};

const metricsChecklist = [
  "Tasks completed",
  "Rework count",
  "Time vs estimate",
  "Checklist compliance",
  "Blocked tasks",
  "Milestone health",
  "Activity logs",
  "Manager comments",
];

export default async function ReportsPage() {
  const session = await getSession();
  const hasDatabase = Boolean(process.env.DATABASE_URL);
  const role = normalizeRole(session?.role);
  const isAdmin = isAdminRole(role);

  let activitySummary = null;

  if (hasDatabase && isAdmin) {
    const rangeStart = new Date();
    rangeStart.setDate(rangeStart.getDate() - 7);

    const [activityCount, commentCount, durationTotal] = await Promise.all([
      prisma.activityLog.count({ where: { date: { gte: rangeStart } } }),
      prisma.comment.count({ where: { createdAt: { gte: rangeStart } } }),
      prisma.activityLog.aggregate({
        where: { date: { gte: rangeStart } },
        _sum: { durationSeconds: true },
      }),
    ]);

    activitySummary = {
      activityCount,
      commentCount,
      hoursTotal: Number(
        ((durationTotal?._sum?.durationSeconds ?? 0) / 3600).toFixed(2)
      ),
    };
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Reports"
        title="Stakeholder-ready reporting & analytics"
        subtitle="Live accountability dashboards, performance scorecards, and auto-generated reports."
        actions={
          <Button
            label="Generate report"
            variant="success"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            toast={{
              title: "Report queued",
              message: "Report outputs are formatted for email delivery.",
              variant: "success",
            }}
          />
        }
      />

      {/* NEW Interactive Analytics & Reporting Dashboard at Top */}
      <ReportingDashboard session={session} />

      {/* Existing Report Templates & Coverage below */}
      <div className="space-y-5 pt-6 border-t border-[color:var(--color-border)]">
        <h2 className="text-base font-semibold text-[color:var(--color-text)]">Scheduled Report Templates & Email Delivery</h2>
        {reports.map((report) => (
          <Card
            key={report.title}
            className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"
          >
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {report.title}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {report.cadence}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Audience: {report.audience}
              </p>
              <p className="mt-1 text-xs font-medium text-primary">
                {report.delivery}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {report.sections.map((section) => (
                  <Badge
                    key={section}
                    variant="outline"
                    className="bg-muted/50 px-2 py-1 text-[11px] font-medium text-muted-foreground"
                  >
                    {section}
                  </Badge>
                ))}
              </div>
            </div>
            <Button
              label="Preview"
              size="sm"
              variant="secondary"
              toast={{
                title: "Preview mode",
                message: "Email-ready report templates are available.",
                variant: "info",
              }}
            />
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="p-5 pb-0">
            <CardTitle className="text-sm">Email preview</CardTitle>
            <CardDescription>Preview the tone and structure of the generated stakeholder update.</CardDescription>
          </CardHeader>
          <CardContent className="p-5 text-xs text-muted-foreground">
            <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Subject
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {emailPreview.subject}
              </p>
            </div>
            <p>{emailPreview.greeting}</p>
            <p>{emailPreview.summary}</p>
            <ul className="list-disc space-y-1 pl-4">
              {emailPreview.highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p>{emailPreview.footer}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-5 pb-0">
            <CardTitle className="text-sm">Metrics included</CardTitle>
            <CardDescription>Signals covered by the reporting templates.</CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-4">
          <ul className="space-y-2 text-xs text-muted-foreground">
            {metricsChecklist.map((metric) => (
              <li
                key={metric}
                className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/40 px-3 py-2"
              >
                <span>{metric}</span>
                <Badge variant="secondary" className="px-2 py-0.5 text-[10px] text-primary">Ready</Badge>
              </li>
            ))}
          </ul>
          </CardContent>
        </Card>
      </div>

      {activitySummary && (
        <Card>
          <CardHeader className="p-5 pb-0">
            <CardTitle className="text-sm">Accountability coverage</CardTitle>
            <CardDescription>Last 7 days of operational reporting activity.</CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-4">
          <div className="grid gap-3 text-xs text-muted-foreground md:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
              <p className="text-muted-foreground">Activity logs</p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {activitySummary.activityCount}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
              <p className="text-muted-foreground">Manager comments</p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {activitySummary.commentCount}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
              <p className="text-muted-foreground">Hours logged</p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {activitySummary.hoursTotal}
              </p>
            </div>
          </div>
          </CardContent>
        </Card>
      )}

      <PlaceholderUpload
        label="Executive slides"
        helperText="Upload slide decks to augment reports."
      />
    </div>
  );
}

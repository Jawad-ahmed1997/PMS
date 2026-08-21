/**
 * Build a premium HTML email template for the CEO Executive Briefing.
 */
export function buildCeoExecutiveReportEmailHtml({
  ceoName = "CEO",
  periodLabel, // e.g. "Weekly Executive Briefing (Aug 17 – Aug 22, 2026)"
  metrics,
}) {
  const {
    executiveSummary = "Engineering operations are running smoothly with healthy company-wide utilization and high delivery predictability.",
    totalCompanyHours = 0,
    teamUtilization = 0,
    milestonesOnTrackPercent = 0,
    companyDisciplineScore = 0,
    activeProjectsCount = 0,
    completedTasksCount = 0,
    projectEffortDistribution = [], // [{ projectName, hours, percent, status }]
    keyMilestones = [], // [{ title, project, progress, status, dueDate }]
    teamSummary = [], // [{ name, role, activeHours, utilization, completedTasks, discipline }]
    keyWins = [], // ["Released Auth module on Milestone 2", "100% On-time delivery for Project X"]
    keyRisks = [], // ["Project Y Milestone 3 is at risk due to API dependencies"]
  } = metrics || {};

  const getStatusBadge = (status) => {
    switch (status?.toUpperCase()) {
      case "ON_TRACK":
      case "COMPLETED":
        return `<span style="background-color:#064e3b;color:#34d399;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;border:1px solid rgba(52,211,153,0.3);">ON TRACK</span>`;
      case "AT_RISK":
      case "DELAYED":
        return `<span style="background-color:#7f1d1d;color:#f87171;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;border:1px solid rgba(248,113,113,0.3);">AT RISK</span>`;
      default:
        return `<span style="background-color:#78350f;color:#fcd34d;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;border:1px solid rgba(252,211,77,0.3);">IN PROGRESS</span>`;
    }
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${periodLabel}</title>
</head>
<body style="margin:0;padding:0;background-color:#090d16;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f1f5f9;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#090d16;padding:24px 0;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table width="680" border="0" cellspacing="0" cellpadding="0" style="max-width:680px;width:100%;background-color:#0f172a;border:1px solid #1e293b;border-radius:16px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);border-bottom:1px solid #1e293b;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size:11px;font-weight:800;letter-spacing:0.18em;color:#818cf8;text-transform:uppercase;margin-bottom:6px;">
                      GATEKOD SOLUTIONS &bull; EXECUTIVE INTELLIGENCE
                    </div>
                    <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">
                      👔 CEO Executive Briefing
                    </h1>
                    <div style="font-size:13px;color:#94a3b8;margin-top:4px;">
                      ${periodLabel} &bull; Prepared for <strong>${ceoName}</strong>
                    </div>
                  </td>
                  <td align="right" valign="middle">
                    <div style="display:inline-block;background-color:#1e293b;border:1px solid #334155;border-radius:20px;padding:6px 14px;font-size:12px;font-weight:700;color:#38bdf8;">
                      Weekly Report
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Executive Summary Banner -->
          <tr>
            <td style="padding:20px 32px;background-color:#131c31;border-bottom:1px solid #1e293b;">
              <div style="font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">
                Executive Pulse
              </div>
              <div style="font-size:14px;line-height:1.5;color:#e2e8f0;font-style:italic;">
                "${executiveSummary}"
              </div>
            </td>
          </tr>

          <!-- 4 Core Executive Scorecards -->
          <tr>
            <td style="padding:24px 32px 16px 32px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <!-- Company Productive Output -->
                  <td width="25%" style="padding-right:8px;" valign="top">
                    <div style="background-color:#182235;border:1px solid #334155;border-radius:12px;padding:16px 12px;text-align:center;">
                      <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Eng Output</div>
                      <div style="font-size:22px;font-weight:800;color:#38bdf8;margin:6px 0 2px 0;">${totalCompanyHours} <span style="font-size:12px;font-weight:500;">hrs</span></div>
                      <div style="font-size:10px;color:#64748b;">${completedTasksCount} Tasks Delivered</div>
                    </div>
                  </td>

                  <!-- Team Utilization -->
                  <td width="25%" style="padding:0 4px;" valign="top">
                    <div style="background-color:#182235;border:1px solid #334155;border-radius:12px;padding:16px 12px;text-align:center;">
                      <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Team Utilization</div>
                      <div style="font-size:22px;font-weight:800;color:#34d399;margin:6px 0 2px 0;">${teamUtilization}%</div>
                      <div style="font-size:10px;color:#64748b;">Active vs Duty Span</div>
                    </div>
                  </td>

                  <!-- Milestones Health -->
                  <td width="25%" style="padding:0 4px;" valign="top">
                    <div style="background-color:#182235;border:1px solid #334155;border-radius:12px;padding:16px 12px;text-align:center;">
                      <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Milestones</div>
                      <div style="font-size:22px;font-weight:800;color:#a78bfa;margin:6px 0 2px 0;">${milestonesOnTrackPercent}%</div>
                      <div style="font-size:10px;color:#64748b;">On-Track Predictability</div>
                    </div>
                  </td>

                  <!-- Discipline & Reliability -->
                  <td width="25%" style="padding-left:8px;" valign="top">
                    <div style="background-color:#182235;border:1px solid #334155;border-radius:12px;padding:16px 12px;text-align:center;">
                      <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Discipline Score</div>
                      <div style="font-size:22px;font-weight:800;color:#f59e0b;margin:6px 0 2px 0;">${companyDisciplineScore}%</div>
                      <div style="font-size:10px;color:#64748b;">Punctuality & Timers</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Section 1: Project Investment & Effort Distribution -->
          <tr>
            <td style="padding:12px 32px;">
              <div style="font-size:13px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:12px;">
                1. Project Effort & Capital Allocation
              </div>
              <div style="background-color:#182235;border:1px solid #334155;border-radius:12px;padding:16px 20px;">
                ${
                  projectEffortDistribution.length === 0
                    ? `<div style="font-size:12px;color:#64748b;text-align:center;padding:12px;">No project hours recorded during this timeframe.</div>`
                    : projectEffortDistribution
                        .map(
                          (p) => `
                    <div style="margin-bottom:14px;">
                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:4px;">
                        <tr>
                          <td style="font-size:13px;font-weight:700;color:#f1f5f9;">${p.projectName}</td>
                          <td align="right" style="font-size:12px;font-weight:700;color:#94a3b8;">
                            <span style="color:#38bdf8;">${p.hours} hrs</span> &bull; ${p.percent}%
                          </td>
                        </tr>
                      </table>
                      <div style="height:6px;width:100%;background-color:#0f172a;border-radius:3px;overflow:hidden;">
                        <div style="height:6px;width:${Math.min(100, p.percent)}%;background:linear-gradient(90deg, #38bdf8, #818cf8);border-radius:3px;"></div>
                      </div>
                    </div>
                  `
                        )
                        .join("")
                }
              </div>
            </td>
          </tr>

          <!-- Section 2: Strategic Milestones & Deliverables -->
          <tr>
            <td style="padding:12px 32px;">
              <div style="font-size:13px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:12px;">
                2. Key Milestones & Delivery Status
              </div>
              <div style="background-color:#182235;border:1px solid #334155;border-radius:12px;overflow:hidden;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size:12px;text-align:left;">
                  <thead style="background-color:#0f172a;border-bottom:1px solid #334155;color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;">
                    <tr>
                      <th style="padding:10px 14px;">Milestone</th>
                      <th style="padding:10px 14px;">Project</th>
                      <th style="padding:10px 14px;">Target Date</th>
                      <th style="padding:10px 14px;">Progress</th>
                      <th style="padding:10px 14px;text-align:right;">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${
                      keyMilestones.length === 0
                        ? `<tr><td colspan="5" style="padding:16px;text-align:center;color:#64748b;">No active milestones found for this period.</td></tr>`
                        : keyMilestones
                            .map(
                              (m, idx) => `
                      <tr style="border-top:${idx === 0 ? "none" : "1px solid #1e293b"};">
                        <td style="padding:10px 14px;font-weight:700;color:#f1f5f9;">${m.title}</td>
                        <td style="padding:10px 14px;color:#94a3b8;">${m.project}</td>
                        <td style="padding:10px 14px;color:#64748b;font-family:monospace;">${m.dueDate || "N/A"}</td>
                        <td style="padding:10px 14px;">
                          <div style="font-weight:700;color:#38bdf8;">${m.progress}%</div>
                        </td>
                        <td style="padding:10px 14px;text-align:right;">${getStatusBadge(m.status)}</td>
                      </tr>
                    `
                            )
                            .join("")
                    }
                  </tbody>
                </table>
              </div>
            </td>
          </tr>

          <!-- Section 3: Engineering Capacity & Pod Output -->
          <tr>
            <td style="padding:12px 32px;">
              <div style="font-size:13px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:12px;">
                3. Team Capacity & Output Overview
              </div>
              <div style="background-color:#182235;border:1px solid #334155;border-radius:12px;overflow:hidden;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size:12px;text-align:left;">
                  <thead style="background-color:#0f172a;border-bottom:1px solid #334155;color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;">
                    <tr>
                      <th style="padding:10px 14px;">Team Member</th>
                      <th style="padding:10px 14px;">Active Work</th>
                      <th style="padding:10px 14px;">Utilization</th>
                      <th style="padding:10px 14px;">Tasks Done</th>
                      <th style="padding:10px 14px;text-align:right;">Discipline</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${
                      teamSummary.length === 0
                        ? `<tr><td colspan="5" style="padding:16px;text-align:center;color:#64748b;">No team member records available.</td></tr>`
                        : teamSummary
                            .map(
                              (tm, idx) => `
                      <tr style="border-top:${idx === 0 ? "none" : "1px solid #1e293b"};">
                        <td style="padding:10px 14px;">
                          <div style="font-weight:700;color:#f1f5f9;">${tm.name}</div>
                          <div style="font-size:10px;color:#64748b;">${tm.role}</div>
                        </td>
                        <td style="padding:10px 14px;font-weight:700;color:#38bdf8;">${tm.activeHours} hrs</td>
                        <td style="padding:10px 14px;font-weight:700;color:${tm.utilization >= 70 ? "#34d399" : "#f59e0b"};">${tm.utilization}%</td>
                        <td style="padding:10px 14px;color:#f1f5f9;">${tm.completedTasks}</td>
                        <td style="padding:10px 14px;text-align:right;font-weight:700;color:${tm.discipline >= 80 ? "#34d399" : "#f87171"};">${tm.discipline}%</td>
                      </tr>
                    `
                            )
                            .join("")
                    }
                  </tbody>
                </table>
              </div>
            </td>
          </tr>

          <!-- Section 4: Key Wins & Risks / Blockers -->
          <tr>
            <td style="padding:12px 32px 28px 32px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <!-- Key Wins -->
                  <td width="50%" style="padding-right:8px;" valign="top">
                    <div style="background-color:#064e3b20;border:1px solid rgba(52,211,153,0.3);border-radius:12px;padding:16px;">
                      <div style="font-size:12px;font-weight:800;color:#34d399;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">
                        ✨ Key Highlights & Wins
                      </div>
                      <ul style="margin:0;padding-left:18px;font-size:12px;color:#cbd5e1;line-height:1.6;">
                        ${
                          keyWins.length === 0
                            ? `<li>All core milestones progressed according to schedule.</li>`
                            : keyWins.map((w) => `<li>${w}</li>`).join("")
                        }
                      </ul>
                    </div>
                  </td>

                  <!-- Risks & Blockers -->
                  <td width="50%" style="padding-left:8px;" valign="top">
                    <div style="background-color:#7f1d1d20;border:1px solid rgba(248,113,113,0.3);border-radius:12px;padding:16px;">
                      <div style="font-size:12px;font-weight:800;color:#f87171;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">
                        ⚠️ Executive Risks & Alerts
                      </div>
                      <ul style="margin:0;padding-left:18px;font-size:12px;color:#cbd5e1;line-height:1.6;">
                        ${
                          keyRisks.length === 0
                            ? `<li>No critical project blockers flagged this week.</li>`
                            : keyRisks.map((r) => `<li>${r}</li>`).join("")
                        }
                      </ul>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#0a0f1d;border-top:1px solid #1e293b;text-align:center;">
              <div style="font-size:11px;color:#64748b;">
                GateKod Solutions &bull; Performance & Intelligence Cloud &bull; Confidential Executive Briefing
              </div>
              <div style="font-size:10px;color:#475569;margin-top:4px;">
                Generated automatically on ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

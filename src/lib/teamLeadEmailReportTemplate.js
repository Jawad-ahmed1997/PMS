/**
 * Build a premium HTML email template for the Team Lead (TL) Pod Accountability & Discipline Briefing.
 */
export function buildTeamLeadReportEmailHtml({
  leadName = "Team Lead",
  periodLabel, // e.g. "Weekly Pod Summary (Aug 17 – Aug 22, 2026)"
  metrics,
}) {
  const {
    podSummary = "Pod achieved strong delivery velocity with 86% overall discipline. Attendance and task flow remained steady throughout the week.",
    podDisciplineScore = 0,
    totalPodWorkHours = 0,
    podTasksCompleted = 0,
    podTasksTotal = 0,
    podPunctualityPercent = 0,
    memberScorecards = [], // [{ name, role, activeHours, breakHours, idleHours, utilization, attendanceDays, lateArrivals, autoOffCount, lateManualDumps, completedTasks, totalAssigned, disciplineScore, performanceScore }]
    coachingActionItems = [], // ["Remind Ubaid on proper shift out-times to avoid Auto-Off triggers", "Review task estimation sizing with Saad"]
    topPerformerShoutouts = [], // ["Anas delivered 4 tasks with 100% on-time ratio", "Clean attendance across all 4 days"]
  } = metrics || {};

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
            <td style="padding:28px 32px;background:linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%);border-bottom:1px solid #1e293b;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size:11px;font-weight:800;letter-spacing:0.18em;color:#60a5fa;text-transform:uppercase;margin-bottom:6px;">
                      GATEKOD SOLUTIONS &bull; POD MANAGEMENT
                    </div>
                    <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">
                      👥 Team Lead Pod & Discipline Briefing
                    </h1>
                    <div style="font-size:13px;color:#94a3b8;margin-top:4px;">
                      ${periodLabel} &bull; Prepared for <strong>${leadName}</strong>
                    </div>
                  </td>
                  <td align="right" valign="middle">
                    <div style="display:inline-block;background-color:#1e293b;border:1px solid #334155;border-radius:20px;padding:6px 14px;font-size:12px;font-weight:700;color:#60a5fa;">
                      Pod Execution
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Pod Pulse Summary -->
          <tr>
            <td style="padding:20px 32px;background-color:#131c31;border-bottom:1px solid #1e293b;">
              <div style="font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">
                Pod Accountability Pulse
              </div>
              <div style="font-size:14px;line-height:1.5;color:#e2e8f0;font-style:italic;">
                "${podSummary}"
              </div>
            </td>
          </tr>

          <!-- 4 Core Scorecards -->
          <tr>
            <td style="padding:24px 32px 16px 32px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <!-- Pod Discipline Rating -->
                  <td width="25%" style="padding-right:8px;" valign="top">
                    <div style="background-color:#182235;border:1px solid #334155;border-radius:12px;padding:16px 12px;text-align:center;">
                      <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Pod Discipline</div>
                      <div style="font-size:22px;font-weight:800;color:#34d399;margin:6px 0 2px 0;">${podDisciplineScore}%</div>
                      <div style="font-size:10px;color:#64748b;">Punctuality & Reliability</div>
                    </div>
                  </td>

                  <!-- Productive Work Hours -->
                  <td width="25%" style="padding:0 4px;" valign="top">
                    <div style="background-color:#182235;border:1px solid #334155;border-radius:12px;padding:16px 12px;text-align:center;">
                      <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Pod Work</div>
                      <div style="font-size:22px;font-weight:800;color:#38bdf8;margin:6px 0 2px 0;">${totalPodWorkHours} <span style="font-size:12px;font-weight:500;">hrs</span></div>
                      <div style="font-size:10px;color:#64748b;">Active Duty Time</div>
                    </div>
                  </td>

                  <!-- Tasks Output -->
                  <td width="25%" style="padding:0 4px;" valign="top">
                    <div style="background-color:#182235;border:1px solid #334155;border-radius:12px;padding:16px 12px;text-align:center;">
                      <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Task Delivery</div>
                      <div style="font-size:22px;font-weight:800;color:#a78bfa;margin:6px 0 2px 0;">${podTasksCompleted} <span style="font-size:12px;font-weight:500;">/${podTasksTotal}</span></div>
                      <div style="font-size:10px;color:#64748b;">Completed in Period</div>
                    </div>
                  </td>

                  <!-- Punctuality Rate -->
                  <td width="25%" style="padding-left:8px;" valign="top">
                    <div style="background-color:#182235;border:1px solid #334155;border-radius:12px;padding:16px 12px;text-align:center;">
                      <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Punctuality</div>
                      <div style="font-size:22px;font-weight:800;color:#f59e0b;margin:6px 0 2px 0;">${podPunctualityPercent}%</div>
                      <div style="font-size:10px;color:#64748b;">On-Time In-Times</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Section 1: Developer Discipline & Accountability Table -->
          <tr>
            <td style="padding:12px 32px;">
              <div style="font-size:13px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:12px;">
                1. Developer Discipline & Attendance Flags
              </div>
              <div style="background-color:#182235;border:1px solid #334155;border-radius:12px;overflow:hidden;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size:12px;text-align:left;">
                  <thead style="background-color:#0f172a;border-bottom:1px solid #334155;color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;">
                    <tr>
                      <th style="padding:10px 14px;">Member</th>
                      <th style="padding:10px 14px;">Days</th>
                      <th style="padding:10px 14px;">Late In</th>
                      <th style="padding:10px 14px;">Auto Off</th>
                      <th style="padding:10px 14px;">Late Dump</th>
                      <th style="padding:10px 14px;text-align:right;">Discipline</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${
                      memberScorecards.length === 0
                        ? `<tr><td colspan="6" style="padding:16px;text-align:center;color:#64748b;">No member records found for this period.</td></tr>`
                        : memberScorecards
                            .map(
                              (m, idx) => `
                      <tr style="border-top:${idx === 0 ? "none" : "1px solid #1e293b"};">
                        <td style="padding:10px 14px;">
                          <div style="font-weight:700;color:#f1f5f9;">${m.name}</div>
                          <div style="font-size:10px;color:#64748b;">${m.role}</div>
                        </td>
                        <td style="padding:10px 14px;color:#f1f5f9;">${m.attendanceDays}d</td>
                        <td style="padding:10px 14px;">
                          ${
                            m.lateArrivals > 0
                              ? `<span style="color:#f87171;font-weight:700;">${m.lateArrivals} late</span>`
                              : `<span style="color:#34d399;font-weight:700;">0 on-time</span>`
                          }
                        </td>
                        <td style="padding:10px 14px;">
                          ${
                            m.autoOffCount > 0
                              ? `<span style="color:#f59e0b;font-weight:700;">${m.autoOffCount} auto</span>`
                              : `<span style="color:#64748b;">0</span>`
                          }
                        </td>
                        <td style="padding:10px 14px;">
                          ${
                            m.lateManualDumps > 0
                              ? `<span style="color:#f87171;font-weight:700;">${m.lateManualDumps} dumps</span>`
                              : `<span style="color:#64748b;">0</span>`
                          }
                        </td>
                        <td style="padding:10px 14px;text-align:right;font-weight:700;color:${m.disciplineScore >= 80 ? "#34d399" : m.disciplineScore >= 65 ? "#f59e0b" : "#f87171"};">
                          ${m.disciplineScore}%
                        </td>
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

          <!-- Section 2: Work vs Break vs Idle Time Utilization Table -->
          <tr>
            <td style="padding:12px 32px;">
              <div style="font-size:13px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:12px;">
                2. Member Work, Break & Idle Time Distribution
              </div>
              <div style="background-color:#182235;border:1px solid #334155;border-radius:12px;overflow:hidden;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size:12px;text-align:left;">
                  <thead style="background-color:#0f172a;border-bottom:1px solid #334155;color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;">
                    <tr>
                      <th style="padding:10px 14px;">Member</th>
                      <th style="padding:10px 14px;">Active Work</th>
                      <th style="padding:10px 14px;">Breaks (Total)</th>
                      <th style="padding:10px 14px;">Idle Time</th>
                      <th style="padding:10px 14px;text-align:right;">Utilization</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${
                      memberScorecards.length === 0
                        ? `<tr><td colspan="5" style="padding:16px;text-align:center;color:#64748b;">No member timeline records available.</td></tr>`
                        : memberScorecards
                            .map(
                              (m, idx) => `
                      <tr style="border-top:${idx === 0 ? "none" : "1px solid #1e293b"};">
                        <td style="padding:10px 14px;font-weight:700;color:#f1f5f9;">${m.name}</td>
                        <td style="padding:10px 14px;font-weight:700;color:#38bdf8;">${m.activeHours} hrs</td>
                        <td style="padding:10px 14px;color:#f59e0b;">${m.breakHours} hrs</td>
                        <td style="padding:10px 14px;color:#94a3b8;">${m.idleHours} hrs</td>
                        <td style="padding:10px 14px;text-align:right;font-weight:700;color:${m.utilization >= 70 ? "#34d399" : "#f59e0b"};">
                          ${m.utilization}%
                        </td>
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

          <!-- Section 3: Standup Action Items & 1-on-1 Coaching -->
          <tr>
            <td style="padding:12px 32px 28px 32px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <!-- Recognition -->
                  <td width="50%" style="padding-right:8px;" valign="top">
                    <div style="background-color:#064e3b20;border:1px solid rgba(52,211,153,0.3);border-radius:12px;padding:16px;">
                      <div style="font-size:12px;font-weight:800;color:#34d399;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">
                        ⭐ Pod Wins & Recognition
                      </div>
                      <ul style="margin:0;padding-left:18px;font-size:12px;color:#cbd5e1;line-height:1.6;">
                        ${
                          topPerformerShoutouts.length === 0
                            ? `<li>Pod maintained steady output across all active projects.</li>`
                            : topPerformerShoutouts.map((s) => `<li>${s}</li>`).join("")
                        }
                      </ul>
                    </div>
                  </td>

                  <!-- 1-on-1 Coaching -->
                  <td width="50%" style="padding-left:8px;" valign="top">
                    <div style="background-color:#1e3a8a20;border:1px solid rgba(96,165,250,0.3);border-radius:12px;padding:16px;">
                      <div style="font-size:12px;font-weight:800;color:#60a5fa;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">
                        🎯 1-on-1 Coaching & Actions
                      </div>
                      <ul style="margin:0;padding-left:18px;font-size:12px;color:#cbd5e1;line-height:1.6;">
                        ${
                          coachingActionItems.length === 0
                            ? `<li>No immediate coaching action items required.</li>`
                            : coachingActionItems.map((c) => `<li>${c}</li>`).join("")
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
                GateKod Solutions &bull; Pod Management &bull; Confidential Team Lead Briefing
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

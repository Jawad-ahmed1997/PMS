/**
 * Build a premium HTML email template for individual performance & accountability reports.
 */
export function buildPerformanceReportEmailHtml({
  user,
  periodLabel, // e.g. "Weekly Performance Report (Aug 17 - Aug 22, 2026)"
  metrics,
}) {
  const appName = "PMS Cloud";
  const companyName = "GateKod Solution";
  const footerYear = new Date().getFullYear();

  const {
    performanceScore = 0,
    utilizationPercent = 0,
    professionalismPercent = 0,
    totalDutyHours = 0,
    totalActiveHours = 0,
    breakHours = 0,
    idleHours = 0,
    attendanceDays = 0,
    lateArrivals = 0,
    autoOffCount = 0,
    lateManualDumpsCount = 0,
    completedTasks = 0,
    totalAssigned = 0,
    completedOnTime = 0,
    completedLate = 0,
    totalEstimatedHours = 0,
    totalSpentHours = 0,
    distribution = [],
  } = metrics;

  const fmt = (val) => (typeof val === "number" ? Number(val.toFixed(2)) : val);

  const onTimePercent = completedTasks > 0
    ? Math.round((completedOnTime / completedTasks) * 100)
    : 100;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${periodLabel} - ${user.name}</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family:'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px; overflow:hidden; border-radius:16px; background-color:#ffffff; box-shadow:0 4px 12px rgba(0,0,0,0.05); border:1px solid #e2e8f0;">
          
          <!-- Top Header -->
          <tr>
            <td align="center" style="padding:28px 24px; background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%);">
              <span style="display:inline-block; color:#38bdf8; font-size:12px; font-weight:800; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:6px;">${companyName}</span>
              <h1 style="margin:0; color:#ffffff; font-size:24px; font-weight:800; letter-spacing:-0.5px;">${periodLabel}</h1>
              <span style="display:inline-block; margin-top:8px; background-color:rgba(56,189,248,0.15); color:#7dd3fc; font-size:11px; font-weight:700; padding:4px 12px; border-radius:12px; border:1px solid rgba(56,189,248,0.3);">
                Individual Accountability Report
              </span>
            </td>
          </tr>

          <!-- Main Greeting -->
          <tr>
            <td style="padding:24px 28px 12px;">
              <p style="margin:0 0 6px; font-size:16px; font-weight:700; color:#0f172a;">Hi ${user.name},</p>
              <p style="margin:0; font-size:13px; color:#64748b; line-height:1.5;">
                Here is your individual weekly performance scorecard for the selected period. Review your duty utilization, discipline indicators, and task output below.
              </p>
            </td>
          </tr>

          <!-- Top 3 Scorecards Grid -->
          <tr>
            <td style="padding:12px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <!-- Card 1: Performance Score -->
                  <td width="32%" style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px; text-align:center;">
                    <span style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">Overall Score</span>
                    <div style="font-size:24px; font-weight:800; color:#0284c7; margin:4px 0 2px;">${fmt(performanceScore)}<span style="font-size:12px; color:#64748b;">/100</span></div>
                    <span style="font-size:10px; font-weight:700; color:#0369a1;">Performance Pts</span>
                  </td>
                  <td width="2%">&nbsp;</td>
                  <!-- Card 2: Work Utilization -->
                  <td width="32%" style="background-color:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:14px; text-align:center;">
                    <span style="font-size:11px; font-weight:700; color:#166534; text-transform:uppercase;">Utilization</span>
                    <div style="font-size:24px; font-weight:800; color:#15803d; margin:4px 0 2px;">⚡ ${fmt(utilizationPercent)}%</div>
                    <span style="font-size:10px; font-weight:700; color:#166534;">Productive Duty</span>
                  </td>
                  <td width="2%">&nbsp;</td>
                  <!-- Card 3: Professionalism -->
                  <td width="32%" style="background-color:#faf5ff; border:1px solid #e9d5ff; border-radius:12px; padding:14px; text-align:center;">
                    <span style="font-size:11px; font-weight:700; color:#6b21a8; text-transform:uppercase;">Professionalism</span>
                    <div style="font-size:24px; font-weight:800; color:#7e22ce; margin:4px 0 2px;">⭐ ${fmt(professionalismPercent)}%</div>
                    <span style="font-size:10px; font-weight:700; color:#6b21a8;">Discipline Rating</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Section 1: Attendance & Duty Hours Summary -->
          <tr>
            <td style="padding:16px 28px 8px;">
              <h2 style="margin:0 0 10px; font-size:14px; font-weight:800; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #e2e8f0; padding-bottom:6px;">
                1. Attendance & Duty Hours
              </h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; font-size:13px;">
                <tr>
                  <td style="padding:10px 14px; color:#475569; font-weight:600; border-bottom:1px solid #e2e8f0;">Total Duty Logged</td>
                  <td align="right" style="padding:10px 14px; color:#0f172a; font-weight:800; border-bottom:1px solid #e2e8f0;">${fmt(totalDutyHours)} hrs (${attendanceDays} Days)</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px; color:#15803d; font-weight:600; border-bottom:1px solid #e2e8f0;">Active Productive Work</td>
                  <td align="right" style="padding:10px 14px; color:#15803d; font-weight:800; border-bottom:1px solid #e2e8f0;">${fmt(totalActiveHours)} hrs</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px; color:#475569; font-weight:600; border-bottom:1px solid #e2e8f0;">Break Hours Logged</td>
                  <td align="right" style="padding:10px 14px; color:#475569; font-weight:800; border-bottom:1px solid #e2e8f0;">${fmt(breakHours)} hrs</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px; color:#b45309; font-weight:600;">Unaccounted Idle Time</td>
                  <td align="right" style="padding:10px 14px; color:#b45309; font-weight:800;">${fmt(idleHours)} hrs</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Section 2: Consistency & Discipline -->
          <tr>
            <td style="padding:16px 28px 8px;">
              <h2 style="margin:0 0 10px; font-size:14px; font-weight:800; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #e2e8f0; padding-bottom:6px;">
                2. Consistency & Discipline
              </h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; font-size:13px;">
                <tr>
                  <td style="padding:10px 14px; color:#475569; font-weight:600; border-bottom:1px solid #e2e8f0;">Late Check-Ins</td>
                  <td align="right" style="padding:10px 14px; font-weight:800; border-bottom:1px solid #e2e8f0; color:${lateArrivals > 0 ? '#b91c1c' : '#15803d'};">
                    ${lateArrivals > 0 ? `⏰ ${lateArrivals} Late Arrival(s)` : '✓ 0 Late Check-Ins'}
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 14px; color:#475569; font-weight:600; border-bottom:1px solid #e2e8f0;">Auto-Off Occurrences</td>
                  <td align="right" style="padding:10px 14px; font-weight:800; border-bottom:1px solid #e2e8f0; color:${autoOffCount > 0 ? '#b91c1c' : '#15803d'};">
                    ${autoOffCount > 0 ? `🚨 ${autoOffCount} Auto-Off(s)` : '✓ 0 Auto-Offs'}
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 14px; color:#475569; font-weight:600;">Late Retroactive Manual Dumps</td>
                  <td align="right" style="padding:10px 14px; font-weight:800; color:${lateManualDumpsCount > 0 ? '#b91c1c' : '#15803d'};">
                    ${lateManualDumpsCount > 0 ? `⚠️ ${lateManualDumpsCount} Late Dump(s)` : '✓ Timely Logging'}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Section 3: Task Output & Velocity -->
          <tr>
            <td style="padding:16px 28px 16px;">
              <h2 style="margin:0 0 10px; font-size:14px; font-weight:800; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #e2e8f0; padding-bottom:6px;">
                3. Task Completion & Velocity
              </h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; font-size:13px; margin-bottom:12px;">
                <tr>
                  <td style="padding:10px 14px; color:#475569; font-weight:600; border-bottom:1px solid #e2e8f0;">Completed Tasks</td>
                  <td align="right" style="padding:10px 14px; color:#0f172a; font-weight:800; border-bottom:1px solid #e2e8f0;">${completedTasks} / ${totalAssigned} Tasks</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px; color:#475569; font-weight:600; border-bottom:1px solid #e2e8f0;">On-Time Delivery Ratio</td>
                  <td align="right" style="padding:10px 14px; color:#15803d; font-weight:800; border-bottom:1px solid #e2e8f0;">${onTimePercent}% On-Time (${completedOnTime} on-time, ${completedLate} late)</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px; color:#475569; font-weight:600;">Estimated vs Actual Time</td>
                  <td align="right" style="padding:10px 14px; color:#0f172a; font-weight:800;">${fmt(totalEstimatedHours)}h Est vs ${fmt(totalSpentHours)}h Spent</td>
                </tr>
              </table>

              <!-- Distribution breakdown badges -->
              ${distribution.length > 0 ? `
                <div style="font-size:12px; font-weight:700; color:#475569; margin-bottom:6px;">Task & Activity Time Breakdown:</div>
                <div style="background-color:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:10px; font-size:11px;">
                  ${distribution.map((d) => `
                    <span style="display:inline-block; background-color:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-weight:700; padding:3px 8px; border-radius:6px; margin:2px;">
                      ${d.percent}% ${d.label} (${fmt(d.hours)}h)
                    </span>
                  `).join("")}
                </div>
              ` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:20px 24px; border-top:1px solid #e2e8f0; background-color:#f8fafc; color:#94a3b8; font-size:11px; line-height:1.6;">
              ${appName} &middot; ${companyName}<br />
              Automated Individual Performance System<br />
              &copy; ${footerYear} ${appName}. All rights reserved.
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

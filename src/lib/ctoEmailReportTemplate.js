/**
 * Build a premium HTML email template for the CTO Technical Architecture & Quality Report.
 */
export function buildCtoTechnicalReportEmailHtml({
  ctoName = "CTO",
  periodLabel, // e.g. "Weekly Technical Summary (Aug 17 – Aug 22, 2026)"
  metrics,
}) {
  const {
    techSummary = "Engineering operations focused heavily on Backend Business Logic and Full-Stack feature velocity with low rework overhead.",
    totalDevHours = 0,
    reworkRate = 0, // e.g. 4.2%
    activeDomainsCount = 0, // e.g. 9/14 task types
    rdInvestmentPercent = 0, // e.g. 18%
    taskTypeBreakdown = [], // [{ type, hours, percent, color }]
    qualityMetrics = {
      totalTasks: 0,
      cleanDeliveryCount: 0,
      reworkTasksCount: 0,
      avgResolutionHours: 0,
    },
    developerDomainMatrix = [], // [{ name, role, primaryDomain, hours, reworkCount }]
    techDebtAndSecurityAlerts = [], // ["Prisma schema migration pending", "API rate limiting optimization needed"]
    architecturalHighlights = [], // ["Shipped new checklist automation system", "Unified time engine across all reporting"]
  } = metrics || {};

  const getTypeColor = (type) => {
    switch (type) {
      case "FULL_STACK": return "#6366f1";
      case "BACKEND": return "#2563eb";
      case "BUSINESS_LOGIC": return "#3b82f6";
      case "API": return "#0ea5e9";
      case "THIRD_PARTY": return "#06b6d4";
      case "DATABASE": return "#14b8a6";
      case "BUG_FIX": return "#f43f5e";
      case "DEVOPS": return "#8b5cf6";
      case "TESTING": return "#10b981";
      case "PERFORMANCE": return "#f59e0b";
      case "AUTH": return "#d97706";
      default: return "#8b5cf6";
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
            <td style="padding:28px 32px;background:linear-gradient(135deg, #064e3b 0%, #0f172a 100%);border-bottom:1px solid #1e293b;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size:11px;font-weight:800;letter-spacing:0.18em;color:#34d399;text-transform:uppercase;margin-bottom:6px;">
                      GATEKOD SOLUTIONS &bull; TECHNICAL INTELLIGENCE
                    </div>
                    <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">
                      💻 CTO Technical & Quality Report
                    </h1>
                    <div style="font-size:13px;color:#94a3b8;margin-top:4px;">
                      ${periodLabel} &bull; Prepared for <strong>${ctoName}</strong>
                    </div>
                  </td>
                  <td align="right" valign="middle">
                    <div style="display:inline-block;background-color:#1e293b;border:1px solid #334155;border-radius:20px;padding:6px 14px;font-size:12px;font-weight:700;color:#34d399;">
                      Technical Velocity
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Technical Pulse Summary -->
          <tr>
            <td style="padding:20px 32px;background-color:#131c31;border-bottom:1px solid #1e293b;">
              <div style="font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">
                Architecture & Velocity Pulse
              </div>
              <div style="font-size:14px;line-height:1.5;color:#e2e8f0;font-style:italic;">
                "${techSummary}"
              </div>
            </td>
          </tr>

          <!-- 4 Core Technical Scorecards -->
          <tr>
            <td style="padding:24px 32px 16px 32px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <!-- Dev Active Hours -->
                  <td width="25%" style="padding-right:8px;" valign="top">
                    <div style="background-color:#182235;border:1px solid #334155;border-radius:12px;padding:16px 12px;text-align:center;">
                      <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Eng Effort</div>
                      <div style="font-size:22px;font-weight:800;color:#38bdf8;margin:6px 0 2px 0;">${totalDevHours} <span style="font-size:12px;font-weight:500;">hrs</span></div>
                      <div style="font-size:10px;color:#64748b;">Active Dev Sessions</div>
                    </div>
                  </td>

                  <!-- Code Quality / Rework -->
                  <td width="25%" style="padding:0 4px;" valign="top">
                    <div style="background-color:#182235;border:1px solid #334155;border-radius:12px;padding:16px 12px;text-align:center;">
                      <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Rework Rate</div>
                      <div style="font-size:22px;font-weight:800;color:${reworkRate <= 10 ? "#34d399" : "#f87171"};margin:6px 0 2px 0;">${reworkRate}%</div>
                      <div style="font-size:10px;color:#64748b;">QA Re-opens / Fixes</div>
                    </div>
                  </td>

                  <!-- Domain Breadth -->
                  <td width="25%" style="padding:0 4px;" valign="top">
                    <div style="background-color:#182235;border:1px solid #334155;border-radius:12px;padding:16px 12px;text-align:center;">
                      <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Tech Domains</div>
                      <div style="font-size:22px;font-weight:800;color:#a78bfa;margin:6px 0 2px 0;">${activeDomainsCount} <span style="font-size:12px;font-weight:500;">/14</span></div>
                      <div style="font-size:10px;color:#64748b;">Active Categories</div>
                    </div>
                  </td>

                  <!-- R&D & Upskilling -->
                  <td width="25%" style="padding-left:8px;" valign="top">
                    <div style="background-color:#182235;border:1px solid #334155;border-radius:12px;padding:16px 12px;text-align:center;">
                      <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">R&D & Learning</div>
                      <div style="font-size:22px;font-weight:800;color:#34d399;margin:6px 0 2px 0;">${rdInvestmentPercent}%</div>
                      <div style="font-size:10px;color:#64748b;">Skill & Architecture</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Section 1: Architecture & Technical Domain Breakdown (14 Task Types) -->
          <tr>
            <td style="padding:12px 32px;">
              <div style="font-size:13px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:12px;">
                1. Technical Domains & Engineering Distribution
              </div>
              <div style="background-color:#182235;border:1px solid #334155;border-radius:12px;padding:16px 20px;">
                ${
                  taskTypeBreakdown.length === 0
                    ? `<div style="font-size:12px;color:#64748b;text-align:center;padding:12px;">No task domain data recorded for this period.</div>`
                    : taskTypeBreakdown
                        .map(
                          (t) => `
                    <div style="margin-bottom:14px;">
                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:4px;">
                        <tr>
                          <td style="font-size:13px;font-weight:700;color:#f1f5f9;">
                            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${getTypeColor(t.type)};margin-right:6px;"></span>
                            ${t.type}
                          </td>
                          <td align="right" style="font-size:12px;font-weight:700;color:#94a3b8;">
                            <span style="color:#38bdf8;">${t.hours} hrs</span> &bull; ${t.percent}%
                          </td>
                        </tr>
                      </table>
                      <div style="height:6px;width:100%;background-color:#0f172a;border-radius:3px;overflow:hidden;">
                        <div style="height:6px;width:${Math.min(100, t.percent)}%;background:${getTypeColor(t.type)};border-radius:3px;"></div>
                      </div>
                    </div>
                  `
                        )
                        .join("")
                }
              </div>
            </td>
          </tr>

          <!-- Section 2: Developer Technical Domain Matrix -->
          <tr>
            <td style="padding:12px 32px;">
              <div style="font-size:13px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:12px;">
                2. Developer Specialization & Quality Matrix
              </div>
              <div style="background-color:#182235;border:1px solid #334155;border-radius:12px;overflow:hidden;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size:12px;text-align:left;">
                  <thead style="background-color:#0f172a;border-bottom:1px solid #334155;color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;">
                    <tr>
                      <th style="padding:10px 14px;">Engineer</th>
                      <th style="padding:10px 14px;">Primary Focus Area</th>
                      <th style="padding:10px 14px;">Dev Hours</th>
                      <th style="padding:10px 14px;text-align:right;">Reworks</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${
                      developerDomainMatrix.length === 0
                        ? `<tr><td colspan="4" style="padding:16px;text-align:center;color:#64748b;">No developer matrix data available.</td></tr>`
                        : developerDomainMatrix
                            .map(
                              (dev, idx) => `
                      <tr style="border-top:${idx === 0 ? "none" : "1px solid #1e293b"};">
                        <td style="padding:10px 14px;">
                          <div style="font-weight:700;color:#f1f5f9;">${dev.name}</div>
                          <div style="font-size:10px;color:#64748b;">${dev.role}</div>
                        </td>
                        <td style="padding:10px 14px;">
                          <span style="background-color:#1e293b;border:1px solid #334155;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600;color:#93c5fd;">
                            ${dev.primaryDomain}
                          </span>
                        </td>
                        <td style="padding:10px 14px;font-weight:700;color:#38bdf8;">${dev.hours} hrs</td>
                        <td style="padding:10px 14px;text-align:right;">
                          ${
                            dev.reworkCount > 0
                              ? `<span style="color:#f87171;font-weight:700;">${dev.reworkCount} issues</span>`
                              : `<span style="color:#34d399;font-weight:700;">0 clean</span>`
                          }
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

          <!-- Section 3: Architecture Highlights & Technical Debt Alerts -->
          <tr>
            <td style="padding:12px 32px 28px 32px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <!-- Highlights -->
                  <td width="50%" style="padding-right:8px;" valign="top">
                    <div style="background-color:#064e3b20;border:1px solid rgba(52,211,153,0.3);border-radius:12px;padding:16px;">
                      <div style="font-size:12px;font-weight:800;color:#34d399;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">
                        ⚡ Architecture Milestones
                      </div>
                      <ul style="margin:0;padding-left:18px;font-size:12px;color:#cbd5e1;line-height:1.6;">
                        ${
                          architecturalHighlights.length === 0
                            ? `<li>Core engineering infrastructure remained stable.</li>`
                            : architecturalHighlights.map((h) => `<li>${h}</li>`).join("")
                        }
                      </ul>
                    </div>
                  </td>

                  <!-- Tech Debt & Alerts -->
                  <td width="50%" style="padding-left:8px;" valign="top">
                    <div style="background-color:#7f1d1d20;border:1px solid rgba(248,113,113,0.3);border-radius:12px;padding:16px;">
                      <div style="font-size:12px;font-weight:800;color:#f87171;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">
                        🛠️ Tech Debt & Bottlenecks
                      </div>
                      <ul style="margin:0;padding-left:18px;font-size:12px;color:#cbd5e1;line-height:1.6;">
                        ${
                          techDebtAndSecurityAlerts.length === 0
                            ? `<li>No critical technical debt or security bottlenecks detected.</li>`
                            : techDebtAndSecurityAlerts.map((a) => `<li>${a}</li>`).join("")
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
                GateKod Solutions &bull; Technical Architecture Intelligence &bull; Confidential CTO Briefing
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

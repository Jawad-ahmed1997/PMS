import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendInviteEmail({ to, name, inviteUrl }) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
    <body style="margin:0; padding:0; background-color:#0f1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f1117; padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="480" cellpadding="0" cellspacing="0" style="background-color:#1a1d27; border-radius:16px; border:1px solid #2a2d3a; overflow:hidden;">
              <tr>
                <td style="padding:40px 36px 24px;">
                  <p style="margin:0 0 4px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:2px; color:#8b8fa3;">
                    Team Invitation
                  </p>
                  <h1 style="margin:0 0 20px; font-size:24px; font-weight:600; color:#e4e5ea;">
                    You're invited to PMS Gatekod Solutions
                  </h1>
                  <p style="margin:0 0 24px; font-size:14px; line-height:1.6; color:#8b8fa3;">
                    Hi <strong style="color:#e4e5ea;">${name}</strong>,<br /><br />
                    Your team has invited you to join <strong style="color:#e4e5ea;">PMS Gatekod Solutions</strong> — a project management platform. 
                    Click the button below to set your password and activate your account.
                  </p>
                  <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                    <tr>
                      <td style="border-radius:12px; background:linear-gradient(135deg, #6366f1, #818cf8);">
                        <a href="${inviteUrl}" 
                           style="display:inline-block; padding:14px 32px; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none; letter-spacing:0.3px;">
                          Set Your Password →
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:0 0 8px; font-size:12px; color:#6b6f82;">
                    Or copy and paste this link into your browser:
                  </p>
                  <p style="margin:0 0 24px; font-size:12px; color:#6366f1; word-break:break-all;">
                    ${inviteUrl}
                  </p>
                  <div style="border-top:1px solid #2a2d3a; padding-top:16px;">
                    <p style="margin:0; font-size:11px; color:#6b6f82;">
                      ⏳ This invitation link expires in <strong style="color:#f59e0b;">48 hours</strong>. 
                      If it expires, ask your admin to resend the invitation.
                    </p>
                  </div>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0; font-size:11px; color:#4a4d5a; text-align:center;">
              PMS Gatekod Solutions · Project Management System
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `Hi ${name},\n\nYou've been invited to join PMS Cloud. Set your password to activate your account:\n\n${inviteUrl}\n\nThis link expires in 48 hours.\n\n— PMS Cloud`;

  await transporter.sendMail({
    from: `PMS GK <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: "You're invited to PMS Gatekod Solutions",
    html,
    text,
  });
}

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
  const appName = "PMS Cloud";
  const supportEmail = "https://www.gatekod.com";
  const invitationDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
  const footerYear = new Date().getFullYear();

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Invitation to ${appName}</title>
    </head>
    <body style="margin:0; padding:0; background-color:#f5f7fb; font-family:'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color:#0f172a;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f7fb;">
        <tr>
          <td align="center" style="padding:24px 12px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px; overflow:hidden; border:1px solid #e4e8ec; border-radius:16px; background-color:#ffffff; font-family:'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
              <tr>
                <td align="center" style="padding:30px 24px 26px; background-color:#0f0f0f;">
                  <span style="display:inline-block; color:#ffffff; font-size:32px; font-weight:800; letter-spacing:-0.8px; line-height:1;">GateKod Solution</span>
                </td>
              </tr>
              <tr>
                <td style="padding:32px 32px 24px; font-size:15px; line-height:1.6; color:#334155;">
                  <p style="margin:0 0 8px; color:#667085; font-size:12px; font-weight:700; letter-spacing:1.3px; text-transform:uppercase;">You are invited</p>
                  <h1 style="margin:0 0 14px; color:#0f172a; font-size:28px; line-height:1.25; font-weight:700; letter-spacing:-0.5px;">Join ${appName}</h1>
                  <p style="margin:0 0 20px;">Hi <strong style="color:#0f172a;">${name}</strong>,</p>
                  <p style="margin:0 0 20px;">Your team has invited you to join ${appName}, a focused workspace for managing projects, people, and daily operations.</p>
                  <p style="margin:0 0 22px;">Review the invitation details below, then accept to set your password and activate your account.</p>

                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px; border:1px solid #e4e8ec; border-radius:12px; background-color:#f8fafc;">
                    <tr>
                      <td style="padding:18px 20px;">
                        <p style="margin:0 0 13px; color:#0f0f0f; font-size:12px; font-weight:800; letter-spacing:1.2px; text-transform:uppercase;">Invitation details</p>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px; line-height:1.5;">
                          <tr><td style="padding:5px 0; color:#667085;">Invited by</td><td align="right" style="padding:5px 0; color:#1e293b; font-weight:700;">${appName} team<br /><span style="color:#667085; font-size:12px; font-weight:400;">${supportEmail}</span></td></tr>
                          <tr><td style="padding:5px 0; color:#667085;">Invited email</td><td align="right" style="padding:5px 0; color:#1e293b; font-weight:700; word-break:break-word;">${to}</td></tr>
                          <tr><td style="padding:5px 0; color:#667085;">Assigned role</td><td align="right" style="padding:5px 0; color:#1e293b; font-weight:700;">Team member</td></tr>
                          <tr><td style="padding:5px 0; color:#667085;">Invitation date</td><td align="right" style="padding:5px 0; color:#1e293b; font-weight:700;">${invitationDate}</td></tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px; border:1px solid #e4e8ec; border-radius:12px; background-color:#ffffff;">
                    <tr>
                      <td align="center" style="padding:20px;">
                        <a href="${inviteUrl}" style="display:block; padding:13px 20px; border-radius:9px; background-color:#0f0f0f; color:#ffffff; font-size:14px; font-weight:700; text-align:center; text-decoration:none;">Accept invitation&nbsp; &#8594;</a>
                        <div style="height:10px; line-height:10px;">&nbsp;</div>
                      </td>
                    </tr>
                  </table>

                  <p style="margin:0 0 20px; color:#667085; font-size:12px; line-height:1.6;">If the button does not work, copy and paste this link into your browser:<br /><a href="${inviteUrl}" style="color:#16836c; word-break:break-all;">${inviteUrl}</a></p>
                  <p style="margin:0 0 12px; padding-top:18px; border-top:1px solid #eef1f4; color:#667085; font-size:12px; line-height:1.6;"><strong style="color:#334155;">Keep this invitation private.</strong><br />This link is unique to you. Do not forward the email or share the invitation link.</p>
                  <p style="margin:0; color:#667085; font-size:12px; line-height:1.6;">This invitation expires in <strong style="color:#a16207;">48 hours</strong>. If it expires, ask your administrator to resend it.</p>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:14px 24px 20px; border-top:1px solid #f1f3f5; color:#98a2b3; font-size:11px; line-height:1.7;">
                  ${appName} &middot; Project Management System<br />
                  <a href="mailto:${supportEmail}" style="color:#667085; text-decoration:none;">${supportEmail}</a><br />
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

  const text = `Hi ${name},\n\nYou've been invited to join ${appName}.\n\nInvited email: ${to}\nAssigned role: Team member\nInvitation date: ${invitationDate}\nInvited by: ${appName} team (${supportEmail})\n\nAccept Invitation: ${inviteUrl}\n\nThis invitation is unique to you and should not be shared. It expires in 48 hours.\n\n— ${appName}`;

  await transporter.sendMail({
    from: `PMS GK <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: "You're invited to PMS Gatekod Solutions",
    html,
    text,
  });
}

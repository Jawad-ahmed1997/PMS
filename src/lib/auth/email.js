import nodemailer from "nodemailer";
import { getAuthBaseUrl } from "./env";

function transporter() {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) return null;
  return nodemailer.createTransport({ host: process.env.EMAIL_HOST, port: Number(process.env.EMAIL_PORT || 587), secure: process.env.EMAIL_SECURE === "true", auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD } });
}

async function send(to, subject, text) {
  const client = transporter();
  if (!client) {
    if (process.env.NODE_ENV === "production") throw new Error("Transactional email is not configured.");
    return;
  }
  await client.sendMail({ from: process.env.EMAIL_FROM || process.env.EMAIL_USER, to, subject, text });
}

export function buildResetUrl(token) { return `${getAuthBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`; }
export function sendPasswordResetEmail(to, token) { return send(to, "Reset your PMS Cloud password", `Reset your password: ${buildResetUrl(token)}\n\nThis link expires in 45 minutes. If you did not request this, you can ignore this email.`); }
export function sendPasswordChangedEmail(to) { return send(to, "Your PMS Cloud password was changed", "Your password was changed successfully. If you did not make this change, contact an administrator immediately."); }

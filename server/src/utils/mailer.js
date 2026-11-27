import nodemailer from 'nodemailer';
import { env, clientUrl } from '../config/env.js';
import { logger } from '../config/logger.js';

let transport = null;
const smtpReady = Boolean(env.smtp.host);

if (smtpReady) {
  transport = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
}

export async function sendMail({ to, subject, html, text }) {
  if (!transport) {
    // No SMTP configured: print the message so local development still works end to end.
    logger.warn(`[mail:not-configured] To: ${to} | ${subject}\n${text}`);
    return { delivered: false };
  }
  try {
    await transport.sendMail({ from: env.smtp.from, to, subject, html, text });
    return { delivered: true };
  } catch (err) {
    logger.error('Failed to send email', err);
    return { delivered: false };
  }
}

const shell = (title, body, cta, url) => `
<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#17251A">
  <h2 style="color:#1B5E20;margin:0 0 12px">${title}</h2>
  <p style="line-height:1.5">${body}</p>
  <p><a href="${url}" style="display:inline-block;background:#7ED957;color:#17251A;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">${cta}</a></p>
  <p style="font-size:12px;color:#667">If the button does not work, copy this link: ${url}</p>
</div>`;

export const sendVerificationEmail = (user, token) => {
  const url = `${clientUrl}/verify-email?token=${token}`;
  return sendMail({
    to: user.email,
    subject: 'Verify your SpeakMate email',
    html: shell('Welcome to SpeakMate', 'Confirm your email address to secure your account.', 'Verify email', url),
    text: `Verify your SpeakMate email: ${url}`,
  });
};

export const sendResetEmail = (user, token) => {
  const url = `${clientUrl}/reset-password?token=${token}`;
  return sendMail({
    to: user.email,
    subject: 'Reset your SpeakMate password',
    html: shell('Reset your password', 'This link is valid for 1 hour. If you did not ask for it, you can ignore this email.', 'Choose a new password', url),
    text: `Reset your SpeakMate password (valid 1 hour): ${url}`,
  });
};

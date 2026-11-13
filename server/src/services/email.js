import { env } from '../config/env.js';

// Transactional email through the Brevo REST API (no SDK needed).
export async function sendEmail({ to, subject, html }) {
  if (!env.brevo.apiKey || !env.brevo.senderEmail) {
    console.warn('[email] Brevo not configured; skipping email');
    return { skipped: true };
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.brevo.apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: env.brevo.senderEmail, name: env.brevo.senderName },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) throw new Error(`Brevo send failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Sending one plain email (a password-reset link) through a mail service the owner has an account with.
// Server only. Two services are understood, whichever key is set: Resend (RESEND_API_KEY) or Brevo
// (BREVO_API_KEY). MAIL_FROM is the address the mail comes from, which that service must have approved.
// With none set there is no mailer, and the site says so instead of pretending to send.
export type Mailer = (to: string, subject: string, text: string) => Promise<boolean>;

export function mailerFromEnv(env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): Mailer | undefined {
  const from = env.MAIL_FROM?.trim();
  if (!from) return undefined;
  if (env.RESEND_API_KEY) return async (to, subject, text) => {
    try { return (await fetchImpl("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ from, to: [to], subject, text }) })).ok; } catch { return false; }
  };
  if (env.BREVO_API_KEY) return async (to, subject, text) => {
    try { return (await fetchImpl("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": env.BREVO_API_KEY!, "content-type": "application/json" }, body: JSON.stringify({ sender: { email: from, name: "Patchwalk" }, to: [{ email: to }], subject, textContent: text }) })).ok; } catch { return false; }
  };
  return undefined;
}

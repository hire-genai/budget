import nodemailer from 'nodemailer'

type SendOtpArgs = { to: string; code: string; purpose: 'LOGIN' | 'SIGNUP' }

const APP_NAME = 'Ledger'

function buildTransporter() {
  const host = process.env.SMTP_HOST
  if (!host) return null
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
      : undefined,
  })
}

function otpHtml(code: string, purpose: SendOtpArgs['purpose']) {
  const heading = purpose === 'SIGNUP' ? 'Welcome to Ledger' : 'Your sign-in code'
  return `<!doctype html>
  <html><body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#0B0D12; padding:32px; color:#F3F4F6">
    <div style="max-width:480px;margin:0 auto;background:#141822;border:1px solid #1E232E;border-radius:14px;padding:28px">
      <div style="font-size:18px;font-weight:600;margin-bottom:6px">${heading}</div>
      <div style="font-size:13px;color:#9CA3AF;margin-bottom:20px">Use this one-time code to continue. It expires in 10 minutes.</div>
      <div style="font-size:34px;font-weight:700;letter-spacing:8px;background:#0B0D12;border:1px solid #1E232E;border-radius:10px;padding:16px;text-align:center;font-family:ui-monospace, SFMono-Regular, Menlo, monospace">${code}</div>
      <div style="font-size:12px;color:#6B7280;margin-top:20px">If you didn't request this, you can safely ignore this email.</div>
    </div>
  </body></html>`
}

/**
 * Sends the OTP by email. In dev (no SMTP_HOST), it prints to the server
 * console so you can copy-paste the code without configuring email.
 */
export async function sendOtpEmail({ to, code, purpose }: SendOtpArgs): Promise<void> {
  const t = buildTransporter()
  const subject = `${APP_NAME} verification code: ${code}`
  if (!t) {
    // Dev fallback — visible in the terminal running `npm run dev`.
    // Use a very distinctive banner so it's easy to spot.
    // eslint-disable-next-line no-console
    console.log(
      `\n┌────────────────────────────────────────────────────┐\n` +
      `│  ${APP_NAME} OTP for ${to}\n` +
      `│  Code: ${code}   (purpose: ${purpose}, 10 min)\n` +
      `└────────────────────────────────────────────────────┘\n`,
    )
    return
  }
  await t.sendMail({
    from: process.env.SMTP_FROM || `${APP_NAME} <no-reply@ledger.app>`,
    to,
    subject,
    text: `Your ${APP_NAME} code is ${code}. It expires in 10 minutes.`,
    html: otpHtml(code, purpose),
  })
}

export function isMailerConfigured(): boolean {
  return !!process.env.SMTP_HOST
}

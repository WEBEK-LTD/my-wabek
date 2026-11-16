import { supabaseAdmin } from './supabase'
import { escapeHtml } from './security'

// Only accept plain hex colors in inline styles (prevents CSS/HTML injection).
function safeColor(c: unknown, fallback = '#00D46A'): string {
  return typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : fallback
}

// Only http(s) links in href attributes, HTML-escaped.
function safeUrl(u: unknown): string {
  const s = String(u ?? '')
  return /^https?:\/\//i.test(s) ? escapeHtml(s) : '#'
}

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  username: string
  password: string
  from_name: string
  from_email: string
}

async function getSmtpConfig(): Promise<SmtpConfig | null> {
  // First try env vars (priority)
  if (process.env.SMTP_HOST) {
    return {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'ssl',
      username: process.env.SMTP_USER || '',
      password: process.env.SMTP_PASS || '',
      from_name: process.env.SMTP_FROM_NAME || 'WABEK',
      from_email: process.env.SMTP_FROM || 'noreply@waabek.com',
    }
  }

  // Fallback: read from DB (admin settings)
  try {
    const db = supabaseAdmin()
    const { data } = await db
      .from('system_settings')
      .select('value')
      .eq('key', 'smtp_settings')
      .single()

    if (!data?.value?.host || !data?.value?.username || !data?.value?.password) {
      return null
    }

    const cfg = data.value
    return {
      host: cfg.host || 'my.mailbux.com',
      port: parseInt(cfg.port || '587'),
      secure: cfg.secure === 'ssl',
      username: cfg.username,
      password: cfg.password,
      from_name: cfg.from_name || 'WABEK',
      from_email: cfg.from_email || cfg.username,
    }
  } catch {
    return null
  }
}

export async function sendEmail(opts: EmailOptions): Promise<boolean> {
  const config = await getSmtpConfig()
  if (!config) {
    console.warn('SMTP not configured — email not sent to', opts.to)
    return false
  }

  try {
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: !config.secure && config.port === 587,
      auth: { user: config.username, pass: config.password },
      tls: { rejectUnauthorized: false },
    })

    await transporter.sendMail({
      from: `"${config.from_name}" <${config.from_email}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    })

    return true
  } catch (e) {
    console.error('Email send error:', e)
    return false
  }
}

// Email templates
// `content` is trusted HTML built by the helpers below (which escape their inputs).
export function emailTemplate(content: string, rawBrandName = 'WABEK', rawBrandColor = '#00D46A'): string {
  const brandName = escapeHtml(rawBrandName)
  const brandColor = safeColor(rawBrandColor)
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <!-- Header -->
        <tr><td style="background:#0A0F1E;padding:24px 32px;text-align:center">
          <span style="color:${brandColor};font-size:22px;font-weight:700">${brandName}</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb">
          <p style="margin:0;font-size:12px;color:#9ca3af">© ${new Date().getFullYear()} ${brandName}. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function passwordResetEmail(rawName: string, rawResetUrl: string, brandName = 'WABEK', rawBrandColor = '#00D46A'): string {
  const name = escapeHtml(rawName), resetUrl = safeUrl(rawResetUrl), brandColor = safeColor(rawBrandColor)
  return emailTemplate(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:22px">Reset your password</h2>
    <p style="margin:0 0 12px;color:#475569">Hi ${name},</p>
    <p style="margin:0 0 24px;color:#475569">We received a request to reset your password. Click the button below to create a new one.</p>
    <a href="${resetUrl}" style="display:inline-block;background:${brandColor};color:#000;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Reset Password</a>
    <p style="margin:24px 0 0;color:#9ca3af;font-size:13px">This link expires in <strong>1 hour</strong>. If you didn't request this, you can safely ignore this email.</p>
  `, brandName, brandColor)
}

export function otpEmail(rawName: string, rawCode: string, brandName = 'WABEK', brandColor = '#00D46A'): string {
  const name = escapeHtml(rawName), code = escapeHtml(rawCode)
  return emailTemplate(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:22px">Your verification code</h2>
    <p style="margin:0 0 20px;color:#475569">Hi ${name}, use the code below to verify your identity:</p>
    <div style="background:#f1f5f9;border-radius:12px;padding:20px;text-align:center;margin:0 0 20px">
      <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#0f172a;font-family:monospace">${code}</span>
    </div>
    <p style="margin:0;color:#9ca3af;font-size:13px">This code expires in <strong>10 minutes</strong>. Never share it with anyone.</p>
  `, brandName, brandColor)
}

export function teamInviteEmail(rawInviterName: string, rawTeamName: string, rawInviteUrl: string, rawBrandName = 'WABEK', rawBrandColor = '#00D46A'): string {
  const inviterName = escapeHtml(rawInviterName), teamName = escapeHtml(rawTeamName), inviteUrl = safeUrl(rawInviteUrl)
  const brandName = escapeHtml(rawBrandName), brandColor = safeColor(rawBrandColor)
  return emailTemplate(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:22px">You've been invited!</h2>
    <p style="margin:0 0 12px;color:#475569"><strong>${inviterName}</strong> has invited you to join <strong>${teamName}</strong> on ${brandName}.</p>
    <p style="margin:0 0 24px;color:#475569">Click the button below to accept the invitation and create your account.</p>
    <a href="${inviteUrl}" style="display:inline-block;background:${brandColor};color:#000;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Accept Invitation</a>
    <p style="margin:24px 0 0;color:#9ca3af;font-size:13px">This invitation expires in 7 days.</p>
  `, rawBrandName, brandColor)
}

export function welcomeEmail(rawName: string, rawLoginUrl: string, rawBrandName = 'WABEK', rawBrandColor = '#00D46A'): string {
  const name = escapeHtml(rawName), loginUrl = safeUrl(rawLoginUrl)
  const brandName = escapeHtml(rawBrandName), brandColor = safeColor(rawBrandColor)
  return emailTemplate(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:22px">Welcome to ${brandName}! 🎉</h2>
    <p style="margin:0 0 12px;color:#475569">Hi ${name}, your account is ready.</p>
    <p style="margin:0 0 24px;color:#475569">Start sending WhatsApp campaigns, building chatbots, and automating your customer communication.</p>
    <a href="${loginUrl}" style="display:inline-block;background:${brandColor};color:#000;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Go to Dashboard</a>
  `, rawBrandName, brandColor)
}

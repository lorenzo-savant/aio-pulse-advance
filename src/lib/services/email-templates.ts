// PATH: src/lib/services/email-templates.ts
//
// Shared, brand-coherent email layout + i18n strings for all Resend emails
// (invitations, alerts) and as the source for the Supabase Auth templates
// (confirm / magic-link / reset) that get pasted into the dashboard.
//
// Design decisions:
//   - LIGHT theme (white card on #F6F8FF), matching the live auth pages.
//   - Brand teal accent #0AD0BC (= --color-accent), ink text #011C25.
//   - Wordmark is HTML/CSS, NOT an <img> or inline SVG: Gmail/Outlook strip
//     SVG and remote images are often blocked, so a styled text wordmark is
//     the only reliably-rendered "logo" across clients.
//   - Table-based, inline styles only — the lowest common denominator that
//     survives Gmail/Outlook/Apple Mail.

export type EmailLang = 'en' | 'it' | 'sv'

export const BRAND = {
  name: 'AEO Pulse',
  tagline: {
    en: 'AI Search Visibility Platform',
    it: 'Piattaforma di visibilità nella ricerca AI',
    sv: 'Plattform för AI-sökbarhet',
  },
  teal: '#0AD0BC',
  ink: '#011C25',
  muted: '#798283',
  bg: '#F6F8FF',
  card: '#FFFFFF',
  line: '#E8E8E8',
} as const

export function normalizeLang(input?: string | null): EmailLang {
  const l = (input || '').toLowerCase()
  if (l.startsWith('sv')) return 'sv'
  if (l.startsWith('it')) return 'it'
  return 'en'
}

/** Email-safe wordmark: "AEO" in ink + "Pulse" in teal, with a small pulse dot. */
function wordmark(): string {
  return `
    <span style="font-size:20px;font-weight:800;letter-spacing:-0.3px;color:${BRAND.ink};">AEO</span><span style="font-size:20px;font-weight:800;letter-spacing:-0.3px;color:${BRAND.teal};">Pulse</span>
    <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${BRAND.teal};margin-left:3px;vertical-align:middle;"></span>
  `.trim()
}

interface ShellParams {
  lang: EmailLang
  /** Preview/preheader line shown in the inbox list. */
  preview: string
  /** Inner HTML of the card body (already-translated). */
  body: string
}

/**
 * Wrap translated body HTML in the shared branded shell. Returns a full
 * HTML document string ready for Resend `html` or the Supabase template box.
 */
export function emailShell({ lang, preview, body }: ShellParams): string {
  const year = '2026' // stamped constant — Date.now() is unavailable in some runtimes
  const footer = {
    en: `© ${year} ${BRAND.name}. All rights reserved.`,
    it: `© ${year} ${BRAND.name}. Tutti i diritti riservati.`,
    sv: `© ${year} ${BRAND.name}. Alla rättigheter förbehållna.`,
  }[lang]

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<title>${BRAND.name}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BRAND.bg};">${preview}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="padding:0 4px 20px 4px;">${wordmark()}
              <div style="color:${BRAND.muted};font-size:12px;margin-top:6px;">${BRAND.tagline[lang]}</div>
            </td>
          </tr>
          <tr>
            <td style="background:${BRAND.card};border:1px solid ${BRAND.line};border-radius:16px;padding:32px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 4px 0 4px;text-align:center;color:${BRAND.muted};font-size:12px;line-height:1.6;">
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** A teal CTA button, table-based for Outlook. */
export function ctaButton(label: string, href: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
    <tr>
      <td align="center" style="border-radius:10px;background:${BRAND.teal};">
        <a href="${href}" target="_blank"
           style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:10px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`
}

// ─── Invitation strings ────────────────────────────────────────────────────────

interface InvitationStrings {
  preview: string
  heading: string
  intro: (brand: string, inviter: string) => string
  roleLabel: string
  brandLabel: string
  cta: string
  expiry: string
  ignore: string
}

const INVITATION: Record<EmailLang, InvitationStrings> = {
  en: {
    preview: 'You have been invited to collaborate on AEO Pulse',
    heading: 'You’ve been invited to collaborate',
    intro: (brand, inviter) =>
      `<strong>${inviter}</strong> invited you to join <strong>${brand}</strong> on AEO Pulse — the team’s AI search-visibility workspace.`,
    roleLabel: 'Your role',
    brandLabel: 'Brand',
    cta: 'Accept invitation',
    expiry: 'This invitation expires in 7 days.',
    ignore: 'If you weren’t expecting this, you can safely ignore this email.',
  },
  it: {
    preview: 'Sei stato invitato a collaborare su AEO Pulse',
    heading: 'Sei stato invitato a collaborare',
    intro: (brand, inviter) =>
      `<strong>${inviter}</strong> ti ha invitato a entrare in <strong>${brand}</strong> su AEO Pulse — lo spazio di lavoro del team per la visibilità nella ricerca AI.`,
    roleLabel: 'Il tuo ruolo',
    brandLabel: 'Brand',
    cta: 'Accetta l’invito',
    expiry: 'Questo invito scade tra 7 giorni.',
    ignore: 'Se non te lo aspettavi, puoi ignorare tranquillamente questa email.',
  },
  sv: {
    preview: 'Du har blivit inbjuden att samarbeta på AEO Pulse',
    heading: 'Du har blivit inbjuden att samarbeta',
    intro: (brand, inviter) =>
      `<strong>${inviter}</strong> har bjudit in dig till <strong>${brand}</strong> på AEO Pulse — teamets arbetsyta för AI-sökbarhet.`,
    roleLabel: 'Din roll',
    brandLabel: 'Varumärke',
    cta: 'Acceptera inbjudan',
    expiry: 'Inbjudan upphör att gälla om 7 dagar.',
    ignore: 'Om du inte väntade dig detta kan du bortse från detta mejl.',
  },
}

const ROLE_LABELS: Record<EmailLang, Record<string, string>> = {
  en: { editor: 'Editor', viewer: 'Viewer', admin: 'Admin', owner: 'Owner' },
  it: { editor: 'Editor', viewer: 'Visualizzatore', admin: 'Admin', owner: 'Proprietario' },
  sv: { editor: 'Redaktör', viewer: 'Visning', admin: 'Admin', owner: 'Ägare' },
}

export function renderInvitationEmail(params: {
  lang: EmailLang
  brandName: string
  inviterName: string
  role: string
  acceptUrl: string
}): { subject: string; html: string } {
  const t = INVITATION[params.lang]
  const roleText = ROLE_LABELS[params.lang][params.role] ?? params.role
  const subject = {
    en: `You’ve been invited to ${params.brandName} on AEO Pulse`,
    it: `Sei stato invitato a ${params.brandName} su AEO Pulse`,
    sv: `Du har bjudits in till ${params.brandName} på AEO Pulse`,
  }[params.lang]

  const body = `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:${BRAND.ink};">${t.heading}</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${BRAND.ink};">${t.intro(params.brandName, params.inviterName)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};border-radius:10px;margin:0 0 24px;">
      <tr><td style="padding:14px 16px;border-bottom:1px solid ${BRAND.line};">
        <span style="color:${BRAND.muted};font-size:13px;">${t.roleLabel}:</span>
        <span style="color:${BRAND.ink};font-size:13px;font-weight:600;float:right;">${roleText}</span>
      </td></tr>
      <tr><td style="padding:14px 16px;">
        <span style="color:${BRAND.muted};font-size:13px;">${t.brandLabel}:</span>
        <span style="color:${BRAND.ink};font-size:13px;font-weight:600;float:right;">${params.brandName}</span>
      </td></tr>
    </table>
    ${ctaButton(t.cta, params.acceptUrl)}
    <p style="margin:20px 0 0;font-size:12px;color:${BRAND.muted};">${t.expiry}</p>
    <p style="margin:6px 0 0;font-size:12px;color:${BRAND.muted};">${t.ignore}</p>
  `
  return { subject, html: emailShell({ lang: params.lang, preview: t.preview, body }) }
}

// ─── Alert strings ─────────────────────────────────────────────────────────────

const ALERT_TYPE_LABELS: Record<EmailLang, Record<string, string>> = {
  en: {
    mention_new: 'New Mention',
    mention_lost: 'Mention Lost',
    sentiment_drop: 'Sentiment Drop',
    sentiment_spike: 'Positive Spike',
    competitor_ahead: 'Competitor Leading',
    hallucination: 'Hallucination Detected',
    visibility_change: 'Visibility Change',
    citation_rate_change: 'Citation Rate Change',
    geo_score_drop: 'GEO Score Drop',
    geo_score_critical: 'GEO Score Critical',
  },
  it: {
    mention_new: 'Nuova menzione',
    mention_lost: 'Menzione persa',
    sentiment_drop: 'Calo del sentiment',
    sentiment_spike: 'Picco positivo',
    competitor_ahead: 'Concorrente in testa',
    hallucination: 'Allucinazione rilevata',
    visibility_change: 'Cambio di visibilità',
    citation_rate_change: 'Variazione tasso di citazione',
    geo_score_drop: 'Calo GEO Score',
    geo_score_critical: 'GEO Score critico',
  },
  sv: {
    mention_new: 'Nytt omnämnande',
    mention_lost: 'Förlorat omnämnande',
    sentiment_drop: 'Sentiment-fall',
    sentiment_spike: 'Positiv topp',
    competitor_ahead: 'Konkurrent leder',
    hallucination: 'Hallucination upptäckt',
    visibility_change: 'Synlighetsförändring',
    citation_rate_change: 'Ändrad citeringsfrekvens',
    geo_score_drop: 'GEO Score-fall',
    geo_score_critical: 'GEO Score kritiskt',
  },
}

const ALERT_STR: Record<
  EmailLang,
  { viewCta: string; manage: string; why: (b: string) => string }
> = {
  en: {
    viewCta: 'View in dashboard',
    manage: 'Manage alerts',
    why: (b) => `You’re receiving this because you have an active alert rule for ${b}.`,
  },
  it: {
    viewCta: 'Apri nella dashboard',
    manage: 'Gestisci avvisi',
    why: (b) => `Ricevi questo messaggio perché hai una regola di avviso attiva per ${b}.`,
  },
  sv: {
    viewCta: 'Öppna i instrumentpanelen',
    manage: 'Hantera aviseringar',
    why: (b) => `Du får detta eftersom du har en aktiv aviseringsregel för ${b}.`,
  },
}

/** Teal for positive alerts, red for negative, amber otherwise. */
function alertAccent(alertType: string): string {
  if (['mention_new', 'sentiment_spike'].includes(alertType)) return BRAND.teal
  if (
    [
      'sentiment_drop',
      'hallucination',
      'mention_lost',
      'geo_score_drop',
      'geo_score_critical',
    ].includes(alertType)
  )
    return '#E0484D'
  return '#E6A100'
}

export function renderAlertEmail(params: {
  lang: EmailLang
  brandName: string
  alertType: string
  title: string
  message: string
  data?: Record<string, unknown>
  appUrl: string
}): { subject: string; html: string } {
  const s = ALERT_STR[params.lang]
  const typeLabel = ALERT_TYPE_LABELS[params.lang][params.alertType] ?? params.alertType
  const accent = alertAccent(params.alertType)
  const subject = `[${BRAND.name}] ${typeLabel}: ${params.brandName}`

  const dataRows = params.data
    ? Object.entries(params.data)
        .map(
          ([k, v]) => `
      <tr><td style="padding:10px 16px;border-bottom:1px solid ${BRAND.line};">
        <span style="color:${BRAND.muted};font-size:13px;">${k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</span>
        <span style="color:${BRAND.ink};font-size:13px;font-weight:600;float:right;">${String(v)}</span>
      </td></tr>`,
        )
        .join('')
    : ''

  const body = `
    <span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;color:#FFFFFF;background:${accent};margin-bottom:16px;">${typeLabel}</span>
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:800;color:${BRAND.ink};">${params.title}</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${BRAND.ink};">${params.message}</p>
    ${dataRows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};border-radius:10px;margin:0 0 24px;">${dataRows}</table>` : ''}
    ${ctaButton(s.viewCta, `${params.appUrl}/dashboard/alerts`)}
    <p style="margin:22px 0 0;font-size:12px;color:${BRAND.muted};line-height:1.6;">
      ${s.why(params.brandName)}<br>
      <a href="${params.appUrl}/dashboard/settings" style="color:${BRAND.teal};text-decoration:none;">${s.manage}</a>
    </p>
  `
  return { subject, html: emailShell({ lang: params.lang, preview: params.title, body }) }
}

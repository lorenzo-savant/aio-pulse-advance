# Supabase Auth email templates — AEO Pulse

These three emails (**signup confirmation**, **magic link**, **password reset**)
are sent by **Supabase Auth**, NOT by Resend in our code. They can only be
changed in the Supabase dashboard:

> Supabase → project **"aio advance"** → **Authentication → Emails → Templates**

Paste each HTML block below into the matching template. They use Supabase's
template variables (`{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .SiteURL }}`)
and match the in-app brand (light theme, teal `#0AD0BC` wordmark).

> Supabase templates are **single-language** per project — they don't switch on
> user locale. Pick the primary market language (Swedish for AEO Pulse) OR keep
> English. Swedish + English variants are both provided; paste whichever you
> prefer into each template box. (To truly localize per-user you'd need a custom
> SMTP + Auth Hook — separate, larger task.)

Also set, in the same screen's **Subject** fields:

| Template | Subject (SV) | Subject (EN) |
|---|---|---|
| Confirm signup | Bekräfta din e-postadress – AEO Pulse | Confirm your email — AEO Pulse |
| Magic Link | Din inloggningslänk – AEO Pulse | Your sign-in link — AEO Pulse |
| Reset Password | Återställ ditt lösenord – AEO Pulse | Reset your password — AEO Pulse |

---

## 1. Confirm signup  (variable: `{{ .ConfirmationURL }}`)

### Swedish
```html
<!DOCTYPE html>
<html lang="sv"><head><meta charset="utf-8"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#F6F8FF;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8FF;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td style="padding:0 4px 20px;">
    <span style="font-size:20px;font-weight:800;letter-spacing:-0.3px;color:#011C25;">AEO</span><span style="font-size:20px;font-weight:800;letter-spacing:-0.3px;color:#0AD0BC;">Pulse</span>
    <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#0AD0BC;margin-left:3px;vertical-align:middle;"></span>
    <div style="color:#798283;font-size:12px;margin-top:6px;">Plattform för AI-sökbarhet</div>
  </td></tr>
  <tr><td style="background:#FFFFFF;border:1px solid #E8E8E8;border-radius:16px;padding:32px;">
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#011C25;">Bekräfta din e-postadress</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#011C25;">Välkommen till AEO Pulse! Klicka på knappen nedan för att bekräfta din e-postadress och aktivera ditt konto.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr>
      <td align="center" style="border-radius:10px;background:#0AD0BC;">
        <a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:10px;">Bekräfta e-post</a>
      </td></tr></table>
    <p style="margin:22px 0 0;font-size:12px;color:#798283;">Om du inte skapade ett konto kan du ignorera detta mejl.</p>
  </td></tr>
  <tr><td style="padding:20px 4px 0;text-align:center;color:#798283;font-size:12px;">© 2026 AEO Pulse. Alla rättigheter förbehållna.</td></tr>
</table></td></tr></table></body></html>
```

### English
```html
<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#F6F8FF;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8FF;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td style="padding:0 4px 20px;">
    <span style="font-size:20px;font-weight:800;letter-spacing:-0.3px;color:#011C25;">AEO</span><span style="font-size:20px;font-weight:800;letter-spacing:-0.3px;color:#0AD0BC;">Pulse</span>
    <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#0AD0BC;margin-left:3px;vertical-align:middle;"></span>
    <div style="color:#798283;font-size:12px;margin-top:6px;">AI Search Visibility Platform</div>
  </td></tr>
  <tr><td style="background:#FFFFFF;border:1px solid #E8E8E8;border-radius:16px;padding:32px;">
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#011C25;">Confirm your email</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#011C25;">Welcome to AEO Pulse! Click the button below to confirm your email address and activate your account.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr>
      <td align="center" style="border-radius:10px;background:#0AD0BC;">
        <a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:10px;">Confirm email</a>
      </td></tr></table>
    <p style="margin:22px 0 0;font-size:12px;color:#798283;">If you didn’t create an account, you can ignore this email.</p>
  </td></tr>
  <tr><td style="padding:20px 4px 0;text-align:center;color:#798283;font-size:12px;">© 2026 AEO Pulse. All rights reserved.</td></tr>
</table></td></tr></table></body></html>
```

---

## 2. Magic Link  (variable: `{{ .ConfirmationURL }}`)

### Swedish
```html
<!DOCTYPE html>
<html lang="sv"><head><meta charset="utf-8"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#F6F8FF;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8FF;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td style="padding:0 4px 20px;">
    <span style="font-size:20px;font-weight:800;letter-spacing:-0.3px;color:#011C25;">AEO</span><span style="font-size:20px;font-weight:800;letter-spacing:-0.3px;color:#0AD0BC;">Pulse</span>
    <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#0AD0BC;margin-left:3px;vertical-align:middle;"></span>
    <div style="color:#798283;font-size:12px;margin-top:6px;">Plattform för AI-sökbarhet</div>
  </td></tr>
  <tr><td style="background:#FFFFFF;border:1px solid #E8E8E8;border-radius:16px;padding:32px;">
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#011C25;">Din inloggningslänk</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#011C25;">Klicka på knappen nedan för att logga in på AEO Pulse direkt — inget lösenord behövs.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr>
      <td align="center" style="border-radius:10px;background:#0AD0BC;">
        <a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:10px;">Logga in</a>
      </td></tr></table>
    <p style="margin:22px 0 0;font-size:12px;color:#798283;">Länken går ut snart och kan bara användas en gång. Om du inte begärde den kan du ignorera detta mejl.</p>
  </td></tr>
  <tr><td style="padding:20px 4px 0;text-align:center;color:#798283;font-size:12px;">© 2026 AEO Pulse. Alla rättigheter förbehållna.</td></tr>
</table></td></tr></table></body></html>
```

### English
```html
<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#F6F8FF;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8FF;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td style="padding:0 4px 20px;">
    <span style="font-size:20px;font-weight:800;letter-spacing:-0.3px;color:#011C25;">AEO</span><span style="font-size:20px;font-weight:800;letter-spacing:-0.3px;color:#0AD0BC;">Pulse</span>
    <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#0AD0BC;margin-left:3px;vertical-align:middle;"></span>
    <div style="color:#798283;font-size:12px;margin-top:6px;">AI Search Visibility Platform</div>
  </td></tr>
  <tr><td style="background:#FFFFFF;border:1px solid #E8E8E8;border-radius:16px;padding:32px;">
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#011C25;">Your sign-in link</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#011C25;">Click the button below to sign in to AEO Pulse instantly — no password needed.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr>
      <td align="center" style="border-radius:10px;background:#0AD0BC;">
        <a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:10px;">Sign in</a>
      </td></tr></table>
    <p style="margin:22px 0 0;font-size:12px;color:#798283;">This link expires soon and can be used once. If you didn’t request it, ignore this email.</p>
  </td></tr>
  <tr><td style="padding:20px 4px 0;text-align:center;color:#798283;font-size:12px;">© 2026 AEO Pulse. All rights reserved.</td></tr>
</table></td></tr></table></body></html>
```

---

## 3. Reset Password  (variable: `{{ .ConfirmationURL }}`)

### Swedish
```html
<!DOCTYPE html>
<html lang="sv"><head><meta charset="utf-8"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#F6F8FF;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8FF;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td style="padding:0 4px 20px;">
    <span style="font-size:20px;font-weight:800;letter-spacing:-0.3px;color:#011C25;">AEO</span><span style="font-size:20px;font-weight:800;letter-spacing:-0.3px;color:#0AD0BC;">Pulse</span>
    <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#0AD0BC;margin-left:3px;vertical-align:middle;"></span>
    <div style="color:#798283;font-size:12px;margin-top:6px;">Plattform för AI-sökbarhet</div>
  </td></tr>
  <tr><td style="background:#FFFFFF;border:1px solid #E8E8E8;border-radius:16px;padding:32px;">
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#011C25;">Återställ ditt lösenord</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#011C25;">Vi fick en begäran om att återställa ditt lösenord. Klicka nedan för att välja ett nytt.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr>
      <td align="center" style="border-radius:10px;background:#0AD0BC;">
        <a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:10px;">Återställ lösenord</a>
      </td></tr></table>
    <p style="margin:22px 0 0;font-size:12px;color:#798283;">Länken går ut om en timme. Om du inte begärde detta kan du ignorera mejlet — ditt lösenord ändras inte.</p>
  </td></tr>
  <tr><td style="padding:20px 4px 0;text-align:center;color:#798283;font-size:12px;">© 2026 AEO Pulse. Alla rättigheter förbehållna.</td></tr>
</table></td></tr></table></body></html>
```

### English
```html
<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#F6F8FF;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8FF;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td style="padding:0 4px 20px;">
    <span style="font-size:20px;font-weight:800;letter-spacing:-0.3px;color:#011C25;">AEO</span><span style="font-size:20px;font-weight:800;letter-spacing:-0.3px;color:#0AD0BC;">Pulse</span>
    <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#0AD0BC;margin-left:3px;vertical-align:middle;"></span>
    <div style="color:#798283;font-size:12px;margin-top:6px;">AI Search Visibility Platform</div>
  </td></tr>
  <tr><td style="background:#FFFFFF;border:1px solid #E8E8E8;border-radius:16px;padding:32px;">
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#011C25;">Reset your password</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#011C25;">We received a request to reset your password. Click below to choose a new one.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr>
      <td align="center" style="border-radius:10px;background:#0AD0BC;">
        <a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:10px;">Reset password</a>
      </td></tr></table>
    <p style="margin:22px 0 0;font-size:12px;color:#798283;">This link expires in one hour. If you didn’t request this, ignore this email — your password won’t change.</p>
  </td></tr>
  <tr><td style="padding:20px 4px 0;text-align:center;color:#798283;font-size:12px;">© 2026 AEO Pulse. All rights reserved.</td></tr>
</table></td></tr></table></body></html>
```

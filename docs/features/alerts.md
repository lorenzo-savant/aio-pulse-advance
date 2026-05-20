# Alerts

| Field | Value |
|---|---|
| **Route** | `/dashboard/alerts` |
| **API** | `GET/POST /api/alerts`, `GET/DELETE /api/alerts/[id]` |
| **Sidebar step** | 2 · Monitor |

---

## 🇬🇧 English

### What it does
Defines rules that fire when a monitored brand's AI visibility shifts in a way the user cares about (mention rate drops, sentiment turns negative, new hallucination detected, competitor overtakes…). When a rule matches a fresh `monitoring_results` row, an `alert_events` row is created and channels (email, webhook) dispatch the notification.

### Rule schema
```ts
{
  brand_id, name, type, condition: JsonB,
  channels: ('email'|'webhook')[],
  email?, webhookUrl?,
  is_active, lastFiredAt
}
```

### Supported types
- `mention_rate_drop` — mention rate fell by ≥ X% week-over-week
- `sentiment_negative` — N consecutive results with sentiment_score < threshold
- `hallucination_detected` — any result with `has_hallucination = true`
- `competitor_surge` — competitor mention count spiked
- `position_loss` — `position_avg` dropped below threshold

### Event output (alert_events)
```ts
{
  id, alert_rule_id, brand_id, user_id, type,
  title, message,
  data: JsonB,                            // raw monitoring_results reference
  channels_sent: string[],
  is_read, createdAt
}
```

### Links
- Rule evaluation: `shouldTriggerAlert(rule, monitoringResult)` in [`alerts.ts`](../../src/lib/services/alerts.ts)
- Dispatch: `dispatchAlert(event)` → email via Resend OR webhook via `webhook-delivery.ts` (SSRF-safe)

---

## 🇮🇹 Italiano

### Cosa fa
Definisce regole che si attivano quando la visibilità AI di un brand monitorato cambia in modo rilevante (drop mention rate, sentiment negativo, nuova hallucination, competitor overtake…). Quando una regola matcha una nuova riga `monitoring_results`, viene creata una riga `alert_events` e i canali (email, webhook) dispatchano la notifica.

### Schema regola + Output evento
Identici a EN.

### Tipi supportati
Identici a EN.

### Link
- Valutazione regola: `shouldTriggerAlert` in `alerts.ts`
- Dispatch: `dispatchAlert` → email via Resend O webhook via `webhook-delivery.ts` (SSRF-safe)

---

## 🇸🇪 Svenska

### Vad det gör
Definierar regler som utlöser när ett övervakat varumärkes AI-synlighet förändras på ett sätt användaren bryr sig om (omnämnandetakt sjunker, sentimentet blir negativt, ny hallucination upptäckt, konkurrent kör om…). När en regel matchar en ny `monitoring_results`-rad skapas en `alert_events`-rad och kanaler (e-post, webhook) skickar aviseringen.

### Regelschema + Händelseutdata
Identiska med EN.

### Stödda typer
Identiska med EN.

### Länkar
- Regelutvärdering: `shouldTriggerAlert` i `alerts.ts`
- Utskick: `dispatchAlert` → e-post via Resend ELLER webhook via `webhook-delivery.ts` (SSRF-säker)

---

## Limits & known issues
- **No alert ratelimit per rule** — a flapping signal can dispatch repeatedly. `lastFiredAt` is set but cooldown is rule-dependent and currently informational.
- **Webhook delivery uses `safeFetch`** — SEC-1 fix; SSRF-protected with `BLOCKED_IP` / `BLOCKED_HOST` / `BLOCKED_PROTOCOL` checks.

## Cost
- Pure DB + 1 outbound HTTP per webhook channel + 1 email per email channel.

## Data scope
- All timestamps UTC.
- `condition` JsonB column schema depends on the rule `type`.

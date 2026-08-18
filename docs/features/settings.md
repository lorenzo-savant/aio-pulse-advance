# Settings

| Field | Value |
|---|---|
| **Route** | `/dashboard/settings` |
| **API** | `GET/POST/PATCH/DELETE /api/keys` |
| **Service** | [`src/lib/crypto/secret-box.ts`](../../src/lib/crypto/secret-box.ts) |
| **Sidebar step** | 5 · Account |

---

## 🇬🇧 English

### What it does
Account-level configuration, in four cards:

| Card | What it holds |
|---|---|
| **Profile** | Email (read-only, from auth) and full name |
| **API Keys** | The operator's own AI provider keys — add, enable/disable, remove |
| **Notifications** | Notification preferences |
| **Interface Language** | 🇬🇧 English / 🇮🇹 Italiano / 🇸🇪 Svenska |

**API key storage is the part that matters.** Keys are encrypted at rest with **AES-256-GCM** via [`secret-box.ts`](../../src/lib/crypto/secret-box.ts) (`encryptSecret` / `decryptSecret`), stored in `user_api_keys`, and only ever displayed masked (`maskSecret`). `isEncrypted()` exists so legacy plaintext rows are detectable rather than silently re-encrypted or leaked. The plaintext key is never returned by the API after it is saved — a key can be replaced, not read back.

Keys can be **disabled without being deleted** (`active` / `inactive`), which is what you want when a provider misbehaves: turn it off, keep the row, re-enable later without re-pasting the secret. The consequence of a disabled or exhausted key shows up in [`engine-info`](./engine-info.md), not here.

The interface-language switch sets the UI locale only. It is independent of a brand's `locale` field, which controls prompt language and response interpretation — the two are set in different places on purpose.

> A previous version of the Notifications card offered an "alert email" field with its own Save button. Alert recipients now live with the alert rules themselves; see [`alerts`](./alerts.md).

### Input
- Profile — full name.
- API keys — provider name + secret; `PATCH` toggles active state; `DELETE` removes the row.
- Interface language — `en` | `it` | `sv`.

### Output
```ts
// GET /api/keys
{ keys: [{
    id: string,
    provider: string,
    masked: string,        // never the plaintext
    active: boolean,
    created_at: string
}] }
```

### Data signals
Writes `user_api_keys` (encrypted). Profile and locale are user-scoped preferences.

### Links
- Live consequence of key state: [`engine-info`](./engine-info.md)
- Alert recipients: [`alerts`](./alerts.md)
- Locale list: [`src/i18n/config.ts`](../../src/i18n/config.ts)

---

## 🇮🇹 Italiano

### Cosa fa
Configurazione a livello account, in quattro card:

| Card | Cosa contiene |
|---|---|
| **Profilo** | Email (sola lettura, da auth) e nome completo |
| **Chiavi API** | Le chiavi provider AI dell'operatore — aggiungi, abilita/disabilita, rimuovi |
| **Notifiche** | Preferenze di notifica |
| **Lingua interfaccia** | 🇬🇧 English / 🇮🇹 Italiano / 🇸🇪 Svenska |

**L'archiviazione delle chiavi API è la parte che conta.** Le chiavi sono cifrate a riposo con **AES-256-GCM**, salvate in `user_api_keys`, e mostrate solo mascherate. `isEncrypted()` esiste perché eventuali righe legacy in chiaro siano rilevabili invece di essere ri-cifrate in silenzio o esposte. La chiave in chiaro non viene mai restituita dall'API dopo il salvataggio: una chiave si sostituisce, non si rilegge.

Le chiavi possono essere **disabilitate senza essere eliminate** (`active` / `inactive`), che è ciò che serve quando un provider si comporta male: spegnilo, tieni la riga, riattivala dopo senza reincollare il segreto. La conseguenza di una chiave disabilitata o esaurita appare in [`engine-info`](./engine-info.md), non qui.

Il selettore di lingua interfaccia imposta solo il locale della UI. È indipendente dal campo `locale` del brand, che controlla la lingua dei prompt e l'interpretazione delle risposte — i due si impostano in posti diversi di proposito.

> Una versione precedente della card Notifiche offriva un campo "email avvisi" con un Save proprio. I destinatari degli avvisi vivono ora con le regole stesse; vedi [`alerts`](./alerts.md).

### Input
- Profilo — nome completo.
- Chiavi API — nome provider + segreto; `PATCH` cambia lo stato attivo; `DELETE` elimina la riga.
- Lingua interfaccia — `en` | `it` | `sv`.

### Output
Stessa shape della versione EN. `masked` non è mai il testo in chiaro.

### Dati generati
Scrive `user_api_keys` (cifrato). Profilo e locale sono preferenze a livello utente.

---

## 🇸🇪 Svenska

### Vad det gör
Kontonivåkonfiguration, i fyra kort:

| Kort | Vad det innehåller |
|---|---|
| **Profil** | E-post (skrivskyddad, från auth) och fullständigt namn |
| **API-nycklar** | Operatörens egna AI-leverantörsnycklar — lägg till, aktivera/inaktivera, ta bort |
| **Aviseringar** | Aviseringsinställningar |
| **Gränssnittsspråk** | 🇬🇧 English / 🇮🇹 Italiano / 🇸🇪 Svenska |

**Lagringen av API-nycklar är det som betyder något.** Nycklar krypteras i vila med **AES-256-GCM**, lagras i `user_api_keys` och visas alltid maskerade. `isEncrypted()` finns för att äldre klartextrader ska kunna upptäckas istället för att tyst krypteras om eller läcka. Klartextnyckeln returneras aldrig av API:et efter att den sparats — en nyckel byts ut, den läses inte tillbaka.

Nycklar kan **inaktiveras utan att tas bort** (`active` / `inactive`), vilket är vad man vill när en leverantör krånglar: stäng av, behåll raden, aktivera igen utan att klistra in hemligheten på nytt. Konsekvensen av en inaktiverad eller tömd nyckel syns i [`engine-info`](./engine-info.md), inte här.

Språkväljaren sätter enbart gränssnittets locale. Den är oberoende av varumärkets `locale`-fält, som styr promptspråk och tolkning av svar.

> En tidigare version av Aviseringskortet erbjöd ett fält för "aviserings-e-post" med egen Spara-knapp. Aviseringsmottagare bor nu tillsammans med reglerna; se [`alerts`](./alerts.md).

### Indata
- Profil — fullständigt namn.
- API-nycklar — leverantörsnamn + hemlighet; `PATCH` växlar aktivt läge; `DELETE` tar bort raden.
- Gränssnittsspråk — `en` | `it` | `sv`.

### Utdata
Samma form som EN-versionen.

### Data
Skriver `user_api_keys` (krypterat).

---

## Limits & known issues
- **Keys are user-scoped, not workspace-scoped** — a key added here belongs to the user who added it. A colleague in the same workspace does not inherit it, so provider availability can differ per operator on the same brand.
- **No key validation on save** — the endpoint stores whatever string is submitted. A typo is only discovered when [`engine-info`](./engine-info.md) reports the provider unavailable, or when a run falls through the provider chain.
- **Deleting a key does not stop in-flight runs** — a monitoring run already dispatched continues on the provider it started with.
- **Legacy plaintext rows may exist** — `isEncrypted()` is the guard; anything that reads `user_api_keys` directly must go through it rather than assuming ciphertext.

## Cost
- Free. No model calls; encryption is local.

## Data scope
- `user_api_keys` rows are per user; secrets are AES-256-GCM ciphertext with a per-row IV and are never returned in plaintext.

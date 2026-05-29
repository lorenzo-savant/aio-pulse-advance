# Sync & Deploy Handoff — 2026-05-29

> Segue il deploy live di Rebecca (`DEPLOYMENT_HANDOFF_2026-05-29.md`).
> Questo file copre: **fix cron applicati**, **migration DB verificate**, e le
> **3 azioni che restano agli account di Rebecca**.
>
> Live: **https://aeo-pulse.savantmedia.se**

---

## 1. Cosa è stato fatto (in `main`, pushato a Looziolooz + lorenzo-savant)

| Fix richiesto da Rebecca (§5) | Stato | Commit |
|---|---|---|
| Cron 405 — GET handler su 7 route | ✅ `export const GET = POST` | `308b9f3` |
| Cron 404 — route `geo-analysis` mancante | ✅ creata + servizio precompute | `308b9f3` |
| `report-delivery` non schedulata | ✅ aggiunta in `vercel.json` | `308b9f3` |
| PR #1 (`.vercelignore` + handoff) | ✅ merged in `main` | `0f2391e` |

Più 3 migration di remediation **Supabase advisors** (security + performance).

Tutti i commit passano il pre-commit hook (prettier + `tsc --noEmit`).

---

## 2. Migration Supabase — DA APPLICARE su "aio advance" (`ncnxsathmuhggliuayjx`)

⚠️ Il DB prod è sotto l'org Supabase di **Rebecca**; non raggiungibile dagli
strumenti di Lorenzo. Va applicato da chi ha accesso al dashboard.

### Ordine (rispettare!)

```
1. 20260528000000_postgrest_explicit_grants.sql
2. 20260528100000_fix_security_advisors.sql
3. 20260529000000_add_geo_score_snapshots.sql        ← richiesto dal cron geo-analysis
4. 20260529100000_advisor_revoke_definer_execute.sql
5. 20260529110000_advisor_perf_and_search_path.sql   ← wrappata in BEGIN/COMMIT
```

### Come applicarle — due opzioni

**Opzione A — Supabase CLI (consigliata, applica solo le pending in ordine):**
```bash
# da una clone del repo, loggati come owner del progetto:
supabase login
supabase link --project-ref ncnxsathmuhggliuayjx
supabase db push        # applica le migration mancanti nell'ordine corretto
```

**Opzione B — SQL Editor (dashboard):** apri ogni file in ordine, copia/incolla,
Run. La `20260529110000` ha già `begin; … commit;` quindi è sicura anche
incollata a mano (niente finestra deny-all su `team_members`).

### Verifica post-apply
```sql
-- la tabella nuova esiste con la unique giusta:
select count(*) from public.geo_score_snapshots;            -- 0, nessun errore
-- gli advisor security/perf sono scesi:
-- Dashboard → Advisors → Security/Performance → refresh
```

### ⚠️ Gap noto — `audit_logs` (da sistemare in-place su prod)
L'advisor `auth_rls_initplan` su `public.audit_logs` (`audit_logs_select_org_admin`)
**continuerà a comparire**: quella policy esiste solo in prod, non c'è
definizione nel repo, quindi NON l'ho toccata (riprodurla a memoria rischiava di
allargare l'accesso). Per chiuderlo, leggi la definizione live e ri-wrappa
`auth.uid()`:
```sql
select pg_get_expr(polqual, polrelid) as using_expr
from pg_policy where polname = 'audit_logs_select_org_admin';
-- poi: drop policy + create policy identica, sostituendo
--   auth.uid()  →  (select auth.uid())
-- mantenendo ESATTAMENTE le stesse colonne org/role.
```

### Garanzia di sicurezza dati
Le 3 migration nuove sono state verificate da un controllo avversariale
(audit + red-team). Nessuna fa `DROP TABLE / DELETE / TRUNCATE` su tabelle
esistenti. `drop policy` rimuove una regola RLS, **mai** righe. Un bug critico
trovato in revisione (cast `text`/`uuid` mancante nella policy di
`geo_score_snapshots`, che avrebbe bloccato i proprietari) è stato **corretto**
prima del push (commit `3ea326b`).

---

## 3. Tre azioni che restano agli account di Rebecca

Non delegabili a Lorenzo: sono muri di autorizzazione sugli account di Rebecca.

### 3.1 — Invito a Lorenzo sul team Vercel `savant-media1`
Solo l'owner del team può invitare. Rebecca:
> Vercel → Team `savant-media1` → Settings → Members → Invite →
> `lorenzo@savantmedia.se` (ruolo: Member)

Poi Lorenzo potrà:
```bash
vercel link            # scope: savant-media1, progetto: aio-pulse-advance
vercel env pull .env.local
```

### 3.2 — Redeploy produzione (dopo che i fix cron sono in `main`)
```bash
vercel deploy --prod
```
`CRON_SECRET` è già settato (= `CRON_SECRET_TOKEN`), nessuna env da toccare.
Verifica: i cron rispondono **200** (non 405/404):
```bash
curl -H "Authorization: Bearer <CRON_SECRET_TOKEN>" \
  https://aeo-pulse.savantmedia.se/api/cron/monitoring
```

### 3.3 — Repo specchio `rebeccalipschutz/aio-pulse-advance`
Quel repo **non esiste ancora** (404). È un account User personale di Rebecca,
Lorenzo non può crearlo lì. Rebecca:
> GitHub → New repository → owner `rebeccalipschutz`, name `aio-pulse-advance`,
> **Empty** (no README/gitignore/license)

Poi dal repo di Lorenzo (remote `rebecca` già configurato):
```bash
git push rebecca main
```

> 🧹 Pulizia: cancellare il repo vuoto `lorenzo-savant/aio-pulse-advance-mirror`
> creato per errore in questa sessione →
> github.com/lorenzo-savant/aio-pulse-advance-mirror/settings → Delete

---

## 4. Stato repository (post-sync)

| Remote | URL | `main` |
|---|---|---|
| `origin` (fetch) | Looziolooz/aio-pulse-advance | sync |
| `origin` (push #2) + `savant` | lorenzo-savant/aio-pulse-advance | sync |
| `rebecca` | rebeccalipschutz/aio-pulse-advance | ⏳ da creare |

`git push origin` pubblica su Looziolooz **e** lorenzo-savant in un colpo.

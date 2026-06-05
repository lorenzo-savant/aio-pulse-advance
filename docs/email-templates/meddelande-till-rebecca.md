# Till Rebecca — steg-för-steg-guide (AEO Pulse)

> Allt nedan ligger på dina konton (Supabase "aio advance", Vercel-teamet
> savant-media1, Resend) och kan därför bara göras av dig. Koden från Lorenzos
> sida är klar, testad och pushad — det här är de manuella stegen som återstår.
>
> Gör dem i ordningen nedan. Tidsåtgång: ca 30–45 min totalt.
> Kopiera gärna in resultaten (✅ + ev. URL:er) längst ner när du är klar.

---

## STEG 1 — Kör Supabase-migrationerna (≈5 min) 🔴 viktigast

Detta skapar bl.a. tabellen `geo_score_snapshots` (som GEO-analys-cronen
behöver) och stänger några säkerhets-/prestanda-varningar.

1. Öppna en terminal i en klon av repot (`aio-pulse-advance`) och hämta senaste koden:
   ```bash
   git pull
   ```
2. Logga in och länka projektet (om inte redan gjort):
   ```bash
   supabase login
   supabase link --project-ref ncnxsathmuhggliuayjx
   ```
3. Kör migrationerna:
   ```bash
   supabase db push
   ```
4. **Förväntat resultat** — du kommer se rader som:
   - `NOTICE ... skipping entire migration as a no-op` på
     `20260528100000_fix_security_advisors` → **detta är meningen** (de
     CRM-tabellerna tillhör savantdatabas, inte AEO Pulse).
   - `Applying migration 20260529000000_add_geo_score_snapshots.sql ...` →
     ✅ detta är den viktiga, den skapar GEO-tabellen.
   - Sedan `20260529100000`, `20260529110000`, `20260601120000` utan fel.
5. **Om något stannar med ett fel** (t.ex. `relation ... does not exist`):
   stoppa och skicka hela terminalutskriften till Lorenzo — kör inte vidare.

**Verifiera (valfritt):** i Supabase → Table Editor ska tabellen
`geo_score_snapshots` nu finnas.

---

## STEG 2 — Verifiera avsändardomän i Resend (≈10 min + DNS-väntan) 🔴

> Detta är orsaken till att samarbets-inbjudningar inte kommer fram i dag.
> Utan en verifierad domän skickar Resend **bara** till ditt eget konto, inte
> till andra mottagare.

1. Gå till https://resend.com → logga in → **Domains** (vänstermenyn).
2. Klicka **Add Domain**. Skriv in en subdomän, rekommenderat:
   `mail.savantmedia.se` (subdomän är bäst — påverkar inte er vanliga mejl).
3. Resend visar nu ett antal **DNS-poster** (MX, SPF/TXT, DKIM, ev. DMARC).
   Lämna fönstret öppet.
4. Gå till **one.com** (där DNS för savantmedia.se ligger) → DNS-inställningar →
   lägg till exakt de poster Resend visar (kopiera värdena rakt av).
5. Tillbaka i Resend → klicka **Verify**. Det kan ta 5–30 min för DNS att slå
   igenom; klicka Verify igen tills statusen blir **Verified** ✅.

---

## STEG 3 — Sätt avsändaradressen i Vercel (≈3 min)

> Görs när domänen i STEG 2 är **Verified**.

1. Gå till https://vercel.com → team **savant-media1** → projekt
   `aio-pulse-advance` → **Settings → Environment Variables**.
2. Lägg till (eller uppdatera) variabeln:
   - **Name:** `RESEND_FROM_EMAIL`
   - **Value:** `AEO Pulse <no-reply@mail.savantmedia.se>`
     (använd domänen du verifierade i STEG 2)
   - **Environments:** Production, Preview, Development (alla tre)
3. Spara → gå till **Deployments** → öppna senaste → **Redeploy** (så att den
   nya variabeln laddas).

---

## STEG 4 — Testa att inbjudan kommer fram (≈2 min)

1. Logga in i appen → välj ett varumärke → **Team / Samarbetspartners** →
   bjud in en extern adress (t.ex. din privata Gmail).
2. **Förväntat:** mejlet kommer fram inom någon minut, med AEO Pulse-design
   (vit/teal) och på varumärkets språk.
3. Om det INTE kommer fram visar appen nu ett **tydligt felmeddelande** (inte
   längre ett falskt "Invitation sent"). Skicka i så fall felet + en titt i
   Resend → **Logs** (visar bounce/avvisning) till Lorenzo.

---

## STEG 5 — Klistra in Supabase Auth-mejlmallar (≈10 min)

> Mejlen för **bekräftelse / magisk länk / lösenordsåterställning** skickas av
> Supabase Auth (inte vår kod), så de byts i dashboarden. Färdiga mallar med
> rätt design finns i repot: `docs/email-templates/supabase-auth-templates.md`.

1. Öppna `docs/email-templates/supabase-auth-templates.md` i repot.
2. Gå till Supabase → projekt **aio advance** →
   **Authentication → Emails → Templates**.
3. För varje mall (det finns tre):
   - **Confirm signup** → kopiera HTML-blocket "1. Confirm signup" (välj
     **Swedish**-varianten) → klistra in i mall-rutan.
   - **Magic Link** → kopiera "2. Magic Link" (Swedish) → klistra in.
   - **Reset Password** → kopiera "3. Reset Password" (Swedish) → klistra in.
4. Sätt även **Subject** för varje (svenska förslag finns i samma fil, t.ex.
   "Bekräfta din e-postadress – AEO Pulse").
5. Spara varje mall. (Mallarna är enspråkiga per projekt — vi kör svenska som
   standard; engelska finns i samma fil om du hellre vill ha det.)

**Verifiera:** gör en lösenordsåterställning på ditt eget konto → mejlet ska nu
ha AEO Pulse-designen.

---

## STEG 6 — Bjud in Lorenzo till Vercel-teamet (≈2 min)

> Så att Lorenzo kan deploya och hämta env-vars själv, utan att gå via dig.

1. Vercel → team **savant-media1** → **Settings → Members → Invite**.
2. E-post: `lorenzo@savantmedia.se` — roll: **Member**. Skicka.

---

## STEG 7 — Rensa cache på startsidan (≈1 min) 🟡 litet

> Startsidan visar fortfarande "AIO Pulse" pga edge-cache (resten av appen
> visar redan "AEO Pulse").

1. Vercel → projekt `aio-pulse-advance` → **Deployments** → senaste
   produktionsdeployen → **⋯**-menyn → **Redeploy** och **avmarkera** "Use
   existing Build Cache". (Eller projektets **Purge Cache** om du ser det.)
2. Öppna https://aeo-pulse.savantmedia.se i ett inkognitofönster → startsidan
   ska nu visa **AEO Pulse**.

---

## ✅ Checklista att fylla i när du är klar

- [ ] STEG 1 — `supabase db push` kört, `geo_score_snapshots` finns
- [ ] STEG 2 — Resend-domän **Verified**: `___________________`
- [ ] STEG 3 — `RESEND_FROM_EMAIL` satt + redeployad
- [ ] STEG 4 — testinbjudan kom fram ✅
- [ ] STEG 5 — tre Auth-mallar inklistrade
- [ ] STEG 6 — Lorenzo inbjuden till savant-media1
- [ ] STEG 7 — startsidan visar AEO Pulse

Hör av dig om något steg strular — skicka gärna terminalutskrift/skärmdump.

Tack! / Lorenzo

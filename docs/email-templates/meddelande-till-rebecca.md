# Meddelande till Rebecca (klart att skicka)

> Operativt handoff-meddelande på svenska. Kopiera texten nedan och skicka till
> Rebecca. Det samlar allt som kräver hennes konton (Supabase / Vercel / Resend)
> — inget av detta kan göras från Lorenzos sida.

---

Hej Rebecca!

Tack för deployen — allt rullar på. Här är statusen och de sakerna som bara du
kan göra (de ligger på dina konton: Supabase "aio advance", Vercel-teamet
savant-media1 och Resend).

**1. Supabase-migrationer — kör `supabase db push`**
Det finns väntande migrationer mot prod-DB:n (bl.a. `geo_score_snapshots` som
behövs för GEO-analys-cronen, säkerhets-/perf-advisors och en härdning av
anon-rättigheter). De är granskade och säkra. Kör från en klon av repot:
```
supabase link --project-ref ncnxsathmuhggliuayjx
supabase db push
```
De CRM-relaterade stegen (`companies` m.m.) hoppas över automatiskt som no-op —
det är meningen, de tillhör savantdatabas, inte AEO Pulse.

**2. Resend — verifiera avsändardomän (VIKTIGT — annars går inga mejl ut)**
Inbjudningsmejl till samarbetspartners kommer inte fram i dag. Orsaken är att
avsändaren inte är en verifierad domän i Resend — då skickar Resend bara till
ditt eget konto, inte till andra mottagare.
- Resend → **Domains** → verifiera `savantmedia.se` (eller en subdomän, t.ex.
  `mail.savantmedia.se`) med DNS-posterna Resend visar.
- Vercel → Environment Variables → sätt
  `RESEND_FROM_EMAIL = AEO Pulse <no-reply@savantmedia.se>` (en adress på den
  verifierade domänen) → redeploya.
- Testa: bjud in en extern adress via team-formuläret → mejlet ska komma fram.
  (Appen visar nu ett tydligt fel om Resend nekar, i stället för att låtsas att
  det gick bra.)

**3. Supabase Auth — nya mejlmallar (bekräftelse / magisk länk / lösenord)**
De mejlen skickas av Supabase Auth (inte vår kod), så de byts i dashboarden:
Supabase → **Authentication → Emails → Templates**. Färdiga HTML-mallar (svenska
+ engelska, samma design som appen) ligger i repot:
`docs/email-templates/supabase-auth-templates.md` — klistra in respektive block.

**4. Vercel — bjud in Lorenzo (så han kan deploya själv)**
Vercel → Team `savant-media1` → Settings → Members → Invite →
`lorenzo@savantmedia.se` (roll: Member). Då kan han köra `vercel env pull` och
deploya utan att gå via dig.

**5. (Litet) Startsidans cache**
Startsidan visar fortfarande "AIO Pulse" pga edge-cache (resten av appen visar
redan "AEO Pulse"). Vercel → projektet → **Purge Cache** löser det direkt,
annars uppdateras det av sig självt.

Hör av dig om något är oklart!

/Lorenzo

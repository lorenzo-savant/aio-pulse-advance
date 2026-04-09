# BAD-REVIEW REPORT — AIO Pulse

Generated: 2026-03-13
Files analyzed: ~70
Issues found: S1: 3, S2: 5, S3: 4, S4: 2
Verdict: NEEDS WORK

---

## CRITICAL (S1) — MUST FIX BEFORE MERGE

[S1] src/app/api/onboarding/route.ts:4-5 — Import introuvable: '@/lib/supabase' et '@/lib/utils'
FIX: Vérifier que les imports sont corrects, le fichier ne compile pas

[S1] src/app/api/onboarding/route.ts:33,88 — Type safety bypass: (db as any) utilisé 2 fois sans @ts-expect-error
FIX: Ajouter types stricts Supabase ou utiliser // @ts-expect-error

[S1] src/lib/supabase.ts — createServerClient() return type est `any`, pas de typage fort
FIX: Définir types精确 pour les réponses Supabase

---

## ERRORS (S2) — REQUIRED FIXES

[S2] src/app/api/\*/route.ts — 125+ instances de (db as any) à travers tous les fichiers API
FIX: Créer types partagés pour les entités (Brand, Prompt, Scan, etc.)

[S2] src/app/api/\*/route.ts — 116+ console.log/error/warn en production
FIX: Remplacer par logger structuré (pino, winston) ou supprimer en prod

[S2] src/app/api/alerts/route.ts — Promise non gérée: .then() sans .catch()
FIX: Ajouter .catch() ou utiliser await avec try/catch

[S2] src/lib/services/\*.ts — console.log pour debugging encore présent
FIX: Supprimer ou utiliser logger approprié

[S2] src/app/api/providers/test/route.ts — Clés API exposées en logs si erreur
FIX: Ne pas logger les détails d'erreur en production

---

## WARNINGS (S3) — SHOULD FIX

[S3] src/app/api/\*/route.ts — Incohérence naming: quelques fichiers utilisent snake_case, autres camelCase
FIX: Standardiser sur camelCase pour les variables JS

[S3] src/components/ui/Button.tsx — Propriété 'variant' utilise strings littérales au lieu de type unions
FIX: Créer type ButtonVariant = 'primary' | 'secondary' | ...

[S3] src/lib/rate-limit.ts — Magic numbers pour les limites
FIX: Extraire en const avec noms explicites

[S3] src/styles/globals.css — 125+ lignes, trop de responsabilités混合
FIXME: Séparer en: tokens.css, components.css, utilities.css

---

## INFO (S4) — RECOMMENDED

[S4] src/app/api/health/route.ts:14 — process.uptime() supprimé mais remplacé par runtime statique
FIX: Optionnel - garder pour compatibilité

[S4] src/app/docs/api/page.tsx — Documentation pourrait être plus complète
FIX: Ajouter exemples de requêtes pour chaque endpoint

---

## SUMMARY

Critical blockers: 3 (imports error, type safety)
Must fix before merge: 5 (any type, console.log, promises)
Recommended improvements: 4 (naming, magic numbers, organization)
Architecture concerns:

- Pas de types partagés pour les entités Supabase
- Console.log dispersés dans tout le code
- Mix de styles dans globals.css

Naming inconsistencies:

- snake_case vs camelCase dans les fichiers API
- someFunction vs getSomeThing vs fetchSome

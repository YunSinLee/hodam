# HODAM Release Changeset Plan

This document defines a safe commit split for the current hardening/refactor batch.

## Commit Set 1: Security + Supabase checks

- Files:
  - `scripts/check-env.mjs`
  - `scripts/check-supabase-security.mjs` (if changed)
  - `.env.example`
  - `SECURITY_HARDENING_NEXT_STEPS.md`
- Verification:
  - `npm run check:env`
  - `npm run check:env:strict`
  - `npm run check:supabase:security`

## Commit Set 2: CI policy hardening

- Files:
  - `.github/workflows/ci.yml`
  - `.github/workflows/security-check.yml`
- Verification:
  - Validate workflow syntax (GitHub UI / action lint)
  - `npm run check:supabase:security:strict:baseline`

## Commit Set 3: Client API boundary refactor

- Files:
  - `src/lib/client/api/*`
  - `src/app/api/{analytics,bead,google-tts,http,payment,profile,thread,user}.ts` (compat wrappers)
  - all import-path updates in `src/app/**` and `src/lib/ui/**`
- Verification:
  - `npm run lint`
  - `npm run test`
  - `npm run build`

## Commit Set 4: Observability (Sentry optional)

- Files:
  - `src/lib/server/observability.ts`
  - `src/lib/server/logger.ts`
  - `src/lib/server/observability.test.ts`
  - `package.json` + lockfile updates
- Verification:
  - `npm run test`
  - `npm run build`

## Final pre-release verification

1. `npm run check:all`
2. `npm run check:supabase:security`
3. `npm run check:supabase:security:strict:baseline`
4. `npm run check:threads:local` (with app running)
5. `npm run test:e2e:payments:local`


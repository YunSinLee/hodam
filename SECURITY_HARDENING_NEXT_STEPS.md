# HODAM Security Hardening Next Steps

This checklist covers items that remain after the DB/API hardening work.

## Current status (2026-04-06)

- `mailer_otp_exp=3600` is already applied.
- `password_hibp_enabled=true` apply was attempted via script, but the current Supabase plan does not support this feature.
- `vulnerable_postgres_version` remains a dashboard/manual operation item.

## 1) Supabase Auth settings (manual in dashboard)

- Reduce OTP expiry to `<= 60 minutes`
  - Supabase Dashboard -> Authentication -> Providers -> Email
- Enable leaked password protection
  - Supabase Dashboard -> Authentication -> Password Security
- Note: if your current plan does not support HIBP leaked-password protection, keep this item tracked and remove temporary CI ignore only after plan upgrade.
- Keep these settings enabled in production only after smoke testing in staging.

## 2) Supabase Postgres patching

- Upgrade Postgres to the latest patched version from Supabase Dashboard.
- Schedule upgrade during low traffic.
- This project currently reports `supabase-postgres-15.8.1.105` as patch-available.
- After upgrade:
  - Run `npm run build`
  - Execute one payment flow and one story flow end-to-end.

## 3) Required runtime env configuration

- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` (or legacy `OPEN_AI_API_KEY`)
- `TOSS_PAYMENTS_SECRET_KEY`
- `TOSS_PAYMENTS_WEBHOOK_SECRET`

## 4) Strongly recommended env configuration

- `TOSS_PAYMENTS_WEBHOOK_HMAC_SECRET`
- `TOSS_PAYMENTS_WEBHOOK_SIGNATURE_HEADER` (default: `x-toss-signature`)
- `TOSS_PAYMENTS_WEBHOOK_SIGNATURE_PREFIX` (optional)
- `TOSS_PAYMENTS_WEBHOOK_SIGNATURE_ENCODING` (`hex` or `base64`, default: `hex`)
- `HODAM_DAILY_AI_COST_LIMIT` (default: `120`)
- `HODAM_DAILY_TTS_CHAR_LIMIT` (default: `30000`)

## 5) Post-deploy verification

- Confirm webhook rejects invalid signature/secret.
- Confirm duplicate payment confirmation does not double-credit beads.
- Confirm daily AI/TTS quota returns `429` after threshold.
- Confirm users cannot access other users' thread/message/payment data.
- Confirm anon role cannot execute critical security-definer RPCs
  - `consume_beads`, `finalize_payment`, `get_my_threads`, `get_thread_detail`
  - Run: `npm run check:supabase:security`

## 6) CI strict gate policy

- CI strict gate now runs by default.
- Temporary strict ignore baseline:
  - `auth_leaked_password_protection`
  - `vulnerable_postgres_version`
- Remove each ignore immediately after the underlying issue is resolved.

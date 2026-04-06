# HODAM 프로덕션 배포 체크리스트

이 문서는 실제 배포 직전/직후에 바로 사용할 수 있는 체크리스트입니다.
현재 기준일: 2026-04-06

관련 런북:
- `SUPABASE_MANUAL_RUNBOOK.md`
- `POST_DEPLOY_SMOKE_RUNBOOK.md`
- `SECURITY_HARDENING_NEXT_STEPS.md`

## 1) 배포 전 필수 게이트

- [ ] `OPENAI_API_KEY=dummy npm run check:all` 통과
- [ ] `npm run check:supabase:security:strict:baseline` 통과
- [ ] `npm run check:oauth -- --runtime-origin=https://<production-domain>` 통과
- [ ] `npm run test:e2e:auth:local` 통과
- [ ] `npm run test:e2e:payments:local` 통과

## 2) 프로덕션 환경변수

### Required

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
OPENAI_API_KEY=<openai-key>
NEXT_PUBLIC_SITE_URL=https://<production-domain>
NEXT_PUBLIC_AUTH_REDIRECT_URL=https://<production-domain>/auth/callback
```

### Strongly Recommended

```bash
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_ACCESS_TOKEN=<supabase-personal-access-token>
SUPABASE_PROJECT_REF=<project-ref>
TOSS_PAYMENTS_SECRET_KEY=<toss-secret-key>
TOSS_PAYMENTS_WEBHOOK_SECRET=<webhook-secret-header-value>
TOSS_PAYMENTS_WEBHOOK_HMAC_SECRET=<webhook-hmac-secret>
NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY=<toss-client-key>
HODAM_DAILY_AI_COST_LIMIT=120
HODAM_DAILY_TTS_CHAR_LIMIT=30000
SENTRY_DSN=<sentry-dsn>
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
```

## 3) OAuth 설정

### Supabase Auth

- [ ] Site URL = `https://<production-domain>`
- [ ] Redirect URL allow-list에 아래 포함
- [ ] `https://<production-domain>/auth/callback`
- [ ] 불필요한 개발 URL 정리

### Google OAuth

- [ ] Authorized redirect URI 일치 확인
- [ ] `https://<project-ref>.supabase.co/auth/v1/callback`
- [ ] OAuth consent screen 배포 상태 확인

### Kakao OAuth

- [ ] 플랫폼에 프로덕션 도메인 등록
- [ ] Redirect URI 등록
- [ ] `https://<project-ref>.supabase.co/auth/v1/callback`

## 4) 결제 설정 (Toss)

- [ ] 클라이언트/시크릿 키가 프로덕션 키로 설정됨
- [ ] 웹훅 URL 설정
- [ ] `https://<production-domain>/api/v1/payments/webhook`
- [ ] 웹훅 헤더/시크릿 정책 문서화
- [ ] 재시도/중복 이벤트 처리 확인 (`duplicate_event` 케이스)

## 5) Supabase 수동 운영 항목

- [ ] Postgres 패치 업그레이드 (`vulnerable_postgres_version`)
- [ ] leaked password protection(HIBP) 플랜 지원 여부 확인 후 활성화
- [ ] 적용 절차는 `SUPABASE_MANUAL_RUNBOOK.md` 기준으로 수행

## 6) 모니터링/알림

- [ ] Sentry 프로젝트 연결 및 알림 채널 구성
- [ ] request-id 기반 이슈 역추적 가능 여부 확인
- [ ] 결제 실패율/웹훅 오류율 대시보드 점검

## 7) 배포 직후 스모크

- [ ] `POST_DEPLOY_SMOKE_RUNBOOK.md` 체크리스트 완료
- [ ] 로그인, 동화 생성, 결제, 번역, TTS 핵심 플로우 검증
- [ ] `x-request-id` 확인 가능한 샘플 장애 로그 확보

## 8) 롤백 기준

- [ ] 결제 승인/지급 불일치 발생
- [ ] `/api/v1/threads` 또는 `/api/v1/story/*` 연속 5xx
- [ ] 로그인 콜백 정체/무한 로딩 재현
- [ ] 위 항목 발생 시 직전 안정 배포로 즉시 롤백

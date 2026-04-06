# 호담 (HODAM) - AI 동화 생성 서비스

AI 기술로 만드는 개인 맞춤형 동화 서비스입니다.

## 🚀 시작하기

### Node 버전

- 최소: `>=20`
- 권장: `22` (`.nvmrc` 참고)

### 환경 설정

1. 환경변수 파일 생성

```bash
cp .env.example .env.local
```

2. 환경변수 점검

```bash
npm run check:env
# 권장값까지 강제 점검하려면
npm run check:env:strict
```

3. 필요한 환경변수 설정 (`.env.example` 참고)

### Cursor MCP 설정 (선택사항)

AI 개발 도구인 Cursor에서 Supabase MCP를 사용하려면:

1. Supabase 대시보드에서 Personal Access Token 생성
2. `.cursor/mcp.json` 파일 생성:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase@latest", "--access-token"],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "your_personal_access_token"
      }
    }
  }
}
```

⚠️ **보안 주의사항**: `.cursor/` 폴더는 `.gitignore`에 포함되어 있어 Git에 추적되지 않습니다.

## 🔒 보안 가이드라인

### 환경변수 관리

- 모든 API 키와 시크릿은 환경변수로 관리
- `.env.local` 파일은 절대 Git에 커밋하지 않음
- 프로덕션 환경에서는 플랫폼의 환경변수 설정 사용

### 파일 보안

- 실제 API 키가 포함된 파일은 `.gitignore`에 추가
- 하드코딩된 토큰이나 시크릿키 사용 금지
- 이미지나 미디어 파일의 서명된 URL 사용 시 주의

### 코드 검토

- 커밋 전 민감한 정보 노출 여부 확인
- `grep -r "sk_\|secret\|key\|token" .` 명령어로 정기 검사
- 문서 파일(.md)에서도 실제 키 노출 주의

## 📘 운영 런북

- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
- [SUPABASE_MANUAL_RUNBOOK.md](./SUPABASE_MANUAL_RUNBOOK.md)
- [POST_DEPLOY_SMOKE_RUNBOOK.md](./POST_DEPLOY_SMOKE_RUNBOOK.md)
- [SECURITY_HARDENING_NEXT_STEPS.md](./SECURITY_HARDENING_NEXT_STEPS.md)

## 📦 설치

```bash
npm install
npm run dev
```

## 🔁 CI

- GitHub Actions `CI` 워크플로우가 push/PR 시 자동으로 아래를 실행합니다.
- `npm run check:audit:prod`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run check:threads:local` (로컬 계약 검증)
- GitHub Actions `Security Check` 워크플로우는 수동 실행/주간 실행으로 `npm run check:supabase:security`를 수행합니다.
- CI/Security Check 모두 `npm run check:supabase:security:strict`를 기본 실행합니다.
- 저장소 변수 `HODAM_SUPABASE_SECURITY_IGNORE_LINTS`로 strict 무시 목록을 설정할 수 있습니다.
- 기본 fallback 무시 목록은 `auth_leaked_password_protection,vulnerable_postgres_version` 입니다.
- 위 fallback은 임시 조치이므로 Supabase 플랜/DB 패치 이후 제거해야 합니다.
- GitHub Actions `E2E Payments` 워크플로우는 수동 실행/주간 실행으로 `npm run test:e2e:payments:local`를 수행합니다.
- `E2E Payments`에 필요한 주요 secret:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `HODAM_TEST_ACCESS_TOKEN` (직접 토큰 주입) 또는 `HODAM_TEST_USER_EMAIL` + `HODAM_TEST_USER_PASSWORD` (워크플로우가 토큰 자동 발급)
- (선택) `SUPABASE_SERVICE_ROLE_KEY`
- 위 secret 조합이 없으면 `E2E Payments` job은 자동으로 skip 됩니다.

## ✅ 운영 점검 커맨드

```bash
# 필수/권장 환경변수 점검
npm run check:env
npm run check:env:strict
# 로컬 배포 전 통합 점검(환경+보안 audit+lint+test+build)
npm run check:all
# 릴리즈 게이트(로컬)
npm run check:release:gate
# 의존성 취약점 점검
npm run check:audit:prod
npm run check:audit:all
# 결제 위젯을 사용하려면 NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY 설정 필요

# OAuth 설정/프로바이더 진단
npm run check:oauth
# runtime origin이 현재 접속 주소와 다르면 명시
npm run check:oauth -- --runtime-origin=http://localhost:3000
# check-oauth는 provider 활성화 여부(google/kakao)도 함께 검사

# 로컬 인증 E2E (sign-in CTA + threads 401 경계 + OAuth provider authorize)
npm run test:e2e:auth:local
# 서비스 role + 테스트 계정이 있으면 e2e 시작 전에 테스트 사용자 자동 보정
HODAM_E2E_ENSURE_TEST_USER=1 HODAM_TEST_USER_EMAIL=... HODAM_TEST_USER_PASSWORD=... SUPABASE_SERVICE_ROLE_KEY=... npm run test:e2e:auth:local
# 포트/프로바이더 커스터마이즈
HODAM_E2E_APP_PORT=3004 HODAM_E2E_OAUTH_PROVIDERS=google,kakao npm run test:e2e:auth:local

# Supabase 보안 점검 (DB RPC + Auth provider + Management advisor)
npm run check:supabase:security
# service role key가 없어도 anon 민감 RPC 차단 여부(권한 경계)는 검사됨
# 엄격 모드: WARN(예: OTP 만료, leaked password protection 비활성화)도 실패 처리
npm run check:supabase:security:strict
# 엄격 모드 + 무시 목록(예: Free 플랜 HIBP 제한)
HODAM_SUPABASE_SECURITY_IGNORE_LINTS=auth_leaked_password_protection,missing_service_role_key npm run check:supabase:security:strict
# 엄격 모드 + 운영 baseline(플랜/DB 패치 수동 이슈 임시 무시)
npm run check:supabase:security:strict:baseline
# Free 플랜 편의 스크립트
npm run check:supabase:security:strict:free
# 참고: 대표 issue name
# - auth_leaked_password_protection
# - vulnerable_postgres_version
# - missing_service_role_key
# CLI 옵션으로도 무시 목록 전달 가능
npm run check:supabase:security:strict -- --ignore-lints=auth_leaked_password_protection
# Management advisor까지 보려면 SUPABASE_ACCESS_TOKEN 필요
# SUPABASE_PROJECT_REF는 없으면 NEXT_PUBLIC_SUPABASE_URL에서 자동 추론

# KPI 조회 (activity/retention 지표)
# 인증 토큰이 필요하며, 기본은 HODAM_TEST_ACCESS_TOKEN 사용
npm run check:kpi
# 조회 개수 조정 (기본 14, 최대 90)
npm run check:kpi -- --limit=30

# Supabase Auth 보안 하드닝 (OTP 만료/유출 비밀번호 보호)
# 기본: dry-run (변경 없음)
npm run supabase:auth:harden
# 실제 반영
npm run supabase:auth:harden:apply
# 참고: HIBP(leaked password protection)는 Supabase Pro 이상 플랜에서만 활성화 가능.
# 현재 플랜에서 미지원이면 OTP 만료만 부분 적용되고 HIBP는 경고 후 스킵됨.
# 타겟 커스터마이즈 예시
HODAM_AUTH_MAILER_OTP_EXP=3600 HODAM_AUTH_PASSWORD_HIBP_ENABLED=true npm run supabase:auth:harden:apply

# API v1 스모크 테스트 (테스트 access token 필요)
HODAM_TEST_ACCESS_TOKEN=... npm run test:smoke:v1
HODAM_TEST_ACCESS_TOKEN=... npm run test:smoke:v1 -- --story --translate

# 결제 경로 스모크 (prepare/history)
HODAM_TEST_ACCESS_TOKEN=... npm run test:smoke:v1 -- --payments

# 결제 confirm까지 포함 (로컬 mock Toss 권장)
HODAM_TEST_ACCESS_TOKEN=... HODAM_TEST_PAYMENT_CONFIRM=1 HODAM_TEST_PAYMENT_KEY=mock_key npm run test:smoke:v1 -- --payments --payments-confirm
# --payments-confirm는 동일 결제 2회 confirm idempotency(alreadyProcessed=true)까지 검증
# 서버 실행 시 TOSS_PAYMENTS_API_BASE_URL을 mock endpoint로 지정하면 안전하게 confirm 검증 가능

# 로컬 Toss mock 서버
npm run mock:toss
# 다른 포트 예시
npm run mock:toss -- --port=4011

# mock Toss + next dev + 결제 smoke를 한 번에 실행
HODAM_TEST_ACCESS_TOKEN=... npm run test:e2e:payments:local
# 또는 테스트 계정으로 토큰 자동 발급
HODAM_TEST_USER_EMAIL=... HODAM_TEST_USER_PASSWORD=... npm run test:e2e:payments:local
# 서비스 role + 테스트 계정이 있으면 결제 e2e 시작 전에 테스트 사용자 자동 보정
HODAM_E2E_ENSURE_TEST_USER=1 HODAM_TEST_USER_EMAIL=... HODAM_TEST_USER_PASSWORD=... SUPABASE_SERVICE_ROLE_KEY=... npm run test:e2e:payments:local
# 포트 커스터마이즈
HODAM_TEST_ACCESS_TOKEN=... HODAM_E2E_APP_PORT=3002 HODAM_E2E_TOSS_PORT=4010 npm run test:e2e:payments:local
```

## 📡 관측성 (Sentry)

- 서버 에러 로거(`src/lib/server/logger.ts`)는 `SENTRY_DSN`이 설정된 경우 Sentry로 예외를 전송합니다.
- 요청 추적을 위해 `requestId`가 자동 태그(`hodam.request_id`)로 전송됩니다.
- 권장 환경변수:
- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT` (예: `production`, `staging`)
- `SENTRY_TRACES_SAMPLE_RATE` (0~1, 기본 0.1)

## 🧱 API 경계 규칙

- 브라우저용 호출 유틸은 `src/lib/client/api/*`를 사용합니다.
- `src/app/api/*.ts`는 하위 호환을 위한 얇은 re-export 래퍼입니다.
- 신규 코드는 `src/lib/client/api/*` 경로를 직접 import 하세요.

## 🔧 로그인 멈춤 트러블슈팅

- 증상: `카카오/구글로 시작하기` 클릭 후 콜백 페이지에서 `로그인 처리 중...` 정체
- 1차 점검:
  - `npm run check:oauth -- --runtime-origin=http://localhost:3000`
  - 실제 접속 포트가 `3001`이면 `--runtime-origin=http://localhost:3001`로 확인
- 자주 발생하는 원인:
  - `NEXT_PUBLIC_SITE_URL`과 실제 접속 origin 불일치
  - Supabase Auth URL allow list에 callback origin 누락
  - 이미 사용/만료된 authorization code 재사용 (`invalid_grant`, `code verifier` 계열)
- 조치:
  - 브라우저에서 사이트 데이터/쿠키 삭제 후 재로그인
  - Supabase Auth provider 설정에서 callback URL 허용 목록 재확인
  - 개발 중 포트를 고정(`3000`)하거나, runtime origin 기준으로 재점검

## 🔎 `/api/v1/threads` 장애 진단

- 네트워크 탭에서 `GET /api/v1/threads` 응답 헤더 확인:
  - `x-hodam-threads-source`: `rpc` | `fallback` | `none`
  - `x-hodam-threads-degraded`: `1` 이면 일부 조회 경로가 실패했음을 의미
  - `x-hodam-threads-degraded-reasons`: `rpc_error`, `fallback_error`, `keywords_error`, `unexpected_exception` 등
- 해석 가이드:
  - `source=rpc`: 정상 RPC 경로
  - `source=fallback`: RPC 실패 후 테이블 직접 조회로 복구
  - `source=none`: RPC/복구 경로 모두 실패하여 빈 목록 응답
- 관련 로컬 점검:
  - `npm run check:threads:local` (서버가 떠있는 상태에서 401/invalid/authorized 경로를 순차 점검)
  - `npm run check:threads:local -- --require-authorized` (authorized 경로 토큰이 없으면 실패 처리)
  - `npm run test:e2e:auth:local`
  - `npm run check:supabase:security`
  - `HODAM_TEST_ACCESS_TOKEN=... npm run test:e2e:auth:local` (유효 토큰 경로의 실제 `/api/v1/threads` 상태코드/헤더까지 점검)
  - `HODAM_TEST_USER_EMAIL=... HODAM_TEST_USER_PASSWORD=... npm run test:e2e:auth:local` (토큰 자동 발급 후 동일 점검)

## 🛠️ 기술 스택

- **Frontend**: Next.js, React, TypeScript
- **Backend**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4o-mini
- **Styling**: Tailwind CSS
- **Development**: Cursor with MCP

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 있습니다.

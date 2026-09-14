# 호담 (HODAM) — 오늘을 담은 잠자리 그림책

아이의 하루를 입력하고 첫 4쪽을 읽은 뒤, 행동을 선택하면 결말 4쪽이 이어지는 개인 맞춤형 그림책 서비스입니다. `/sample`에서는 로그인 없이 읽기 흐름을 체험할 수 있습니다.

## 🚀 시작하기

### Node 버전

- Node.js `22` 최신 패치 (`.nvmrc` 기준, `22.13` 이상)
- 패키지 관리자는 npm이며 `package-lock.json`을 기준으로 `npm ci`를 사용합니다.

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

AI 개발 도구인 Cursor에서 MCP 서버를 사용하려면:

#### Supabase MCP 설정

1. Supabase 대시보드에서 Personal Access Token 생성
2. `.cursor/mcp.json` 파일에 Supabase 설정 추가

#### Figma MCP 설정

1. Figma에서 Personal Access Token 생성:
   - Figma 설정 → Account → Personal Access Tokens
   - 새 토큰 생성 및 복사
2. `.cursor/mcp.json` 파일에 Figma 설정 추가

**전체 설정 예시:**

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase@latest", "--access-token"],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "your_personal_access_token"
      }
    },
    "figma": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-figma"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "your_figma_access_token"
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
- 스토리 생성/이어쓰기/번역 API는 입력뿐 아니라 AI 출력 결과도 안전 주제 필터를 통과해야 저장됨

## 📘 운영 런북

- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
- [SUPABASE_MANUAL_RUNBOOK.md](./SUPABASE_MANUAL_RUNBOOK.md)
- [POST_DEPLOY_SMOKE_RUNBOOK.md](./POST_DEPLOY_SMOKE_RUNBOOK.md)
- [SECURITY_HARDENING_NEXT_STEPS.md](./SECURITY_HARDENING_NEXT_STEPS.md)
- [검색 유입·공개 동화·사이트 등록 운영](docs/search-discovery.md)
- [8쪽 그림책 베타·기존 기록 보존·첫 이용 QA](docs/beta-launch.md)

## 📦 설치

```bash
npm ci
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
- CI/Security Check 모두 필요한 Supabase 연결 설정이 있을 때 `npm run check:supabase:security:strict`를 실행합니다.
- 저장소 변수 `HODAM_SUPABASE_SECURITY_IGNORE_LINTS`로 strict 무시 목록을 설정할 수 있습니다.
- 기본 fallback 무시 목록은 `auth_leaked_password_protection,vulnerable_postgres_version,missing_service_role_key,missing_management_credentials`입니다.
- 위 fallback은 임시 조치입니다. 플랜·DB 패치·운영 자격증명 설정 이후 해당 예외를 제거합니다. 특히 회계 마이그레이션 이후 실제 서버 역할 키 준비 여부는 배포 게이트에서 별도로 확인합니다.
- `Security Check`의 GitHub failed-runs 진단 결과는 Step Summary와 `github-failed-runs-main-report` artifact로 저장됩니다.
- `Security Check` / `E2E Auth` / `E2E Payments`는 required secret이 없으면 기본적으로 `skip`(성공 종료)됩니다.
- 저장소 변수 `HODAM_ENFORCE_SECRET_CHECKS=1`을 설정하면 required secret 누락 시 즉시 `fail` 처리됩니다.
- 운영에서 정기 검증을 강제하려면, secret 세팅 완료 후 `HODAM_ENFORCE_SECRET_CHECKS`를 `1`로 올리세요.
- GitHub Actions `E2E Payments` 워크플로우는 수동 실행/주간 실행으로 아래를 수행합니다.
- `npm run test:e2e:payments:local` (인증 결제 + webhook 타임라인)
- `npm run check:payments:webhook-coverage:strict` (최근 완료 결제 webhook 누락 진단)
- `npm run test:e2e:payments:unauth:local` (비인증 401 경계)
- webhook coverage 결과는 Actions Step Summary와 `payments-webhook-coverage-report` artifact로 저장됩니다.
- GitHub Actions `E2E Auth` 워크플로우는 실행 로그를 `e2e-auth-local-log` artifact로 업로드하며, 실패 시 최근 로그 요약을 Step Summary에 남깁니다.
- `E2E Payments`에 필요한 주요 secret:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `HODAM_TEST_ACCESS_TOKEN` (직접 토큰 주입) 또는 `HODAM_TEST_USER_EMAIL` + `HODAM_TEST_USER_PASSWORD` (워크플로우가 토큰 자동 발급)
- (선택) 로컬 fallback 계정 env: `HODAM_TEST_DEFAULT_USER_EMAIL` + `HODAM_TEST_DEFAULT_USER_PASSWORD`
- `SUPABASE_SERVICE_ROLE_KEY` (9월 회계 마이그레이션 이후 인증 결제 검증에 필수)
- 위 secret 조합이 없으면 `E2E Payments` job은 자동으로 skip 됩니다.
- GitHub failed-runs 진단:
- `npm run check:github:failed-runs -- --limit=20 --branch=main --max-age-hours=240`
- (동일 preset) `npm run check:github:failed-runs:main`
- (로컬 리포트 파일 생성) `npm run check:github:failed-runs:main:report:local`
- (CI 리포트 파일 생성) `npm run check:github:failed-runs:main:report`
- (예산 임계치 0건 게이트) `npm run check:github:failed-runs:main:budget:zero`
- 기본 동작은 "해당 워크플로우에서 더 최근 성공 런이 있으면 과거 실패를 자동 제외"합니다.
- 과거 실패까지 모두 보고 싶다면 `--include-resolved-failures`를 추가하세요.
- `no_jobs_started(workflow_file_or_trigger_issue)` 감지 시 fail 하고 싶다면:
- `npm run check:github:failed-runs:strict-no-jobs -- --limit=20 --branch=main --max-age-hours=240`
- (동일 preset) `npm run check:github:failed-runs:strict-no-jobs:main`
- strict enforcement는 저장소 변수 `HODAM_ENFORCE_GITHUB_NO_JOBS_GUARD=1`로 켤 수 있습니다.
- 실패 예산 enforcement는 저장소 변수로 제어:
- `HODAM_ENFORCE_GITHUB_FAILED_RUN_BUDGET=1`
- `HODAM_GITHUB_FAILED_RUN_MAX_REPORT_FAILURES` (기본 0)
- `HODAM_GITHUB_FAILED_RUN_MAX_NO_JOBS_STARTED` (기본 0)
- 과거 실패 SHA를 임시 무시하려면 저장소 변수 `HODAM_GITHUB_FAILED_RUN_IGNORE_SHAS`에 쉼표 구분 prefix 목록을 넣으세요.

## ✅ 운영 점검 커맨드

```bash
# 필수/권장 환경변수 점검
npm run check:env
npm run check:env:strict
# 로컬 배포 전 통합 점검(환경+보안 audit+lint+test+build)
npm run check:all
# 릴리즈 게이트(로컬)
npm run check:release:gate
# Supabase 수동 업그레이드 직후 후속 검증(통합)
npm run check:post-upgrade
# runtime origin 지정 예시
npm run check:post-upgrade -- --runtime-origin=https://your-domain.com
# 성능 advisor 단계 생략(긴급 점검/권한 제한 환경)
npm run check:post-upgrade -- --runtime-origin=https://your-domain.com --skip-supabase-performance
# Postgres patch upgrade 완료 후 strict 검증 모드
npm run check:post-upgrade -- --runtime-origin=https://your-domain.com --post-db-upgrade
# 의존성 취약점 점검
npm run check:audit:prod
npm run check:audit:all
# 결제 활성화에는 SUPABASE_SERVICE_ROLE_KEY, TOSS_PAYMENTS_SECRET_KEY,
# NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY가 모두 필요

# OAuth 설정/프로바이더 진단
npm run check:oauth
# runtime origin이 현재 접속 주소와 다르면 명시
npm run check:oauth -- --runtime-origin=http://localhost:3000
# check-oauth는 provider 활성화 여부(google/kakao)도 함께 검사
# 로그인 실패 메시지의 [시도 ID]로 callback 메트릭 조회
npm run check:auth:attempt -- --attempt-id=YOUR_ATTEMPT_ID
# runtime origin이 다른 환경이면 명시
npm run check:auth:attempt -- --attempt-id=YOUR_ATTEMPT_ID --runtime-origin=https://your-domain.com

# 로컬 인증 E2E (sign-in CTA + recovery route + threads/list/detail 401 경계 + OAuth provider authorize)
npm run test:e2e:auth:local
# 인증 토큰 필수 모드(토큰 해석 실패 시 즉시 실패)
npm run test:e2e:auth:local:auth
# callback 오류 경로(예: invalid_grant, invalid_request) 렌더링 점검 포함
# 서비스 role + 테스트 계정이 있으면 e2e 시작 전에 테스트 사용자 자동 보정
HODAM_E2E_ENSURE_TEST_USER=1 HODAM_TEST_USER_EMAIL=... HODAM_TEST_USER_PASSWORD=... SUPABASE_SERVICE_ROLE_KEY=... npm run test:e2e:auth:local
# 서비스 role이 있고 고정 테스트 계정을 별도 지정하지 않으면 기본 테스트 유저 자동 생성/사용
HODAM_TEST_AUTO_USER=1 SUPABASE_SERVICE_ROLE_KEY=... npm run test:e2e:auth:local
# auto ensure 비활성화(명시된 자격증명만 사용)
HODAM_E2E_AUTO_ENSURE_TEST_USER=0 npm run test:e2e:auth:local
# 포트/프로바이더 커스터마이즈
HODAM_E2E_APP_PORT=3004 HODAM_E2E_OAUTH_PROVIDERS=google,kakao npm run test:e2e:auth:local

# Supabase 보안 점검 (DB RPC + Auth provider + Management advisor)
npm run check:supabase:security
# Supabase 성능 advisor 점검 (unused_index 리포트)
npm run check:supabase:performance
# strict 모드: unresolved unused index가 있으면 실패
npm run check:supabase:performance:strict
# unused index 자동 분류 리포트 생성 (로컬: reports/local/supabase-unused-indexes-report.md)
npm run check:supabase:performance:report
# CI artifact 경로로 생성
npm run check:supabase:performance:report:ci
# service role key가 없어도 anon 민감 RPC 차단 여부(권한 경계)는 검사됨
# 엄격 모드: WARN(예: OTP 만료, leaked password protection 비활성화)도 실패 처리
npm run check:supabase:security:strict
# 엄격 모드 + 무시 목록(예: Free 플랜 HIBP 제한)
HODAM_SUPABASE_SECURITY_IGNORE_LINTS=auth_leaked_password_protection,missing_service_role_key npm run check:supabase:security:strict
# 엄격 모드 + 운영 baseline(플랜/DB 패치 수동 이슈 임시 무시)
npm run check:supabase:security:strict:baseline
# 엄격 모드 + Postgres 패치 완료 후 게이트(취약 DB 버전은 더 이상 무시하지 않음)
npm run check:supabase:security:strict:post-upgrade
# Free 플랜 편의 스크립트
npm run check:supabase:security:strict:free
# 참고: 대표 issue name
# - auth_leaked_password_protection
# - vulnerable_postgres_version
# - missing_service_role_key
# CLI 옵션으로도 무시 목록 전달 가능
npm run check:supabase:security:strict -- --ignore-lints=auth_leaked_password_protection
# 성능 advisor 무시 목록 전달 예시(인덱스명 또는 cache key)
npm run check:supabase:performance -- --ignore-indexes=idx_messages_created_at
npm run check:supabase:performance -- --ignore-cache-keys=unused_index_public_messages_idx_messages_created_at
# Management advisor까지 보려면 SUPABASE_ACCESS_TOKEN 필요
# SUPABASE_PROJECT_REF는 없으면 NEXT_PUBLIC_SUPABASE_URL에서 자동 추론

# KPI 조회 (activity/retention 지표)
# 인증 토큰이 필요하며, 기본은 HODAM_TEST_ACCESS_TOKEN 사용
# 미설정 시 scripts/get-test-access-token.mjs 로 자동 해석 시도
npm run check:kpi
# 조회 개수 조정 (기본 14, 최대 90)
npm run check:kpi -- --limit=30
# auth callback 진단 수집이 활성화된 경우, kpi_daily에 아래 필드가 추가 집계됩니다.
# - auth_callback_success
# - auth_callback_error
# 위 필드 존재를 강제 검증하려면
npm run check:kpi:auth:strict
# provider 분해 집계(google/kakao) 필드 존재까지 강제하려면
npm run check:kpi:auth:provider:strict

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
# 인증 토큰 필수 모드(토큰 해석 실패 시 즉시 실패)
npm run test:e2e:payments:local:auth
# 또는 테스트 계정으로 토큰 자동 발급
HODAM_TEST_USER_EMAIL=... HODAM_TEST_USER_PASSWORD=... npm run test:e2e:payments:local
# 또는 로컬 fallback 계정 env 사용
HODAM_TEST_DEFAULT_USER_EMAIL=... HODAM_TEST_DEFAULT_USER_PASSWORD=... npm run test:e2e:payments:local
# 서비스 role + 테스트 계정이 있으면 결제 e2e 시작 전에 테스트 사용자 자동 보정
HODAM_E2E_ENSURE_TEST_USER=1 HODAM_TEST_USER_EMAIL=... HODAM_TEST_USER_PASSWORD=... SUPABASE_SERVICE_ROLE_KEY=... npm run test:e2e:payments:local
# 서비스 role이 있고 고정 테스트 계정을 별도 지정하지 않으면 기본 테스트 유저 자동 생성/사용
HODAM_TEST_AUTO_USER=1 SUPABASE_SERVICE_ROLE_KEY=... npm run test:e2e:payments:local
# auto ensure 비활성화(명시된 자격증명만 사용)
HODAM_E2E_AUTO_ENSURE_TEST_USER=0 npm run test:e2e:payments:local
# 포트 커스터마이즈
HODAM_TEST_ACCESS_TOKEN=... HODAM_E2E_APP_PORT=3002 HODAM_E2E_TOSS_PORT=4010 npm run test:e2e:payments:local
# webhook 정산/타임라인 이벤트까지 강제 검증
HODAM_TEST_ACCESS_TOKEN=... HODAM_TEST_PAYMENT_WEBHOOK=1 npm run test:e2e:payments:local
# webhook e2e + strict coverage를 한 번에 실행(필수 env 자동 검증/테스트유저 자동 보정 포함)
npm run test:e2e:payments:webhook:local
# HODAM_TEST_PAYMENT_WEBHOOK=1 모드에는 SUPABASE_SERVICE_ROLE_KEY가 필요
# 없으면 즉시 실패하며, 로컬에서만 스킵하려면 HODAM_E2E_ALLOW_WEBHOOK_SKIP=1 사용 가능
# 로컬 optional 모드(서비스 롤 키가 없으면 strict coverage를 경고 후 건너뜀)
npm run test:e2e:payments:webhook:local:optional
# 결제 API 비인증 접근 차단(401) 검증
npm run test:e2e:payments:unauth:local
# 최근 완료 결제의 webhook transmission 누락 진단
npm run check:payments:webhook-coverage
# strict: 누락이 있으면 실패
npm run check:payments:webhook-coverage:strict -- --lookback-minutes=180 --max-orders=10
# 리포트 파일 생성(마크다운)
npm run check:payments:webhook-coverage -- --report-file=reports/webhook-coverage.md
# 로컬 권장 경로 예시
npm run check:payments:webhook-coverage -- --report-file=reports/local/webhook-coverage.md
# access token 미지정 시 get-test-access-token 스크립트로 자동 해석 시도
# get-test-access-token은 기본 계정 하드코딩 없이 env 기반으로만 동작

# 결제 타임라인 API: orderId 또는 paymentFlowId 둘 중 하나로 조회 가능
# (예) GET /api/v1/payments/timeline?orderId=HODAM_...
# (예) GET /api/v1/payments/timeline?paymentFlowId=order:HODAM_...
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

## 📗 Story API 계약

- `POST /api/v1/story/start` 성공 응답: `threadId`, `turn`, `beadCount`, `includeEnglish`, `includeImage`, `notice`, `imageUrl`, `messages[]`, `selections[]`
- `POST /api/v1/story/continue` 성공 응답: `threadId`, `turn`, `beadCount`, `notice`, `messages[]`, `selections[]`
- `POST /api/v1/story/translate` 성공 응답: `threadId`, `beadCount`, `messages[]`
- `story/start` 주요 에러 코드:
- `AUTH_UNAUTHORIZED`, `REQUEST_JSON_INVALID`, `STORY_START_RATE_LIMITED`, `STORY_START_KEYWORDS_*`, `STORY_START_BLOCKED_TOPIC`, `STORY_START_BLOCKED_OUTPUT`, `AI_SERVICE_NOT_CONFIGURED`, `AI_DAILY_BUDGET_EXCEEDED`, `BEADS_INSUFFICIENT`, `STORY_START_FAILED`
- `story/continue` 주요 에러 코드:
- `AUTH_UNAUTHORIZED`, `REQUEST_JSON_INVALID`, `STORY_CONTINUE_RATE_LIMITED`, `STORY_CONTINUE_THREAD_ID_INVALID`, `STORY_CONTINUE_SELECTION_*`, `STORY_CONTINUE_BLOCKED_TOPIC`, `STORY_CONTINUE_BLOCKED_OUTPUT`, `AI_SERVICE_NOT_CONFIGURED`, `AI_DAILY_BUDGET_EXCEEDED`, `BEADS_INSUFFICIENT`, `THREAD_NOT_FOUND`, `STORY_CONTINUE_FAILED`
- `story/translate` 주요 에러 코드:
- `AUTH_UNAUTHORIZED`, `REQUEST_JSON_INVALID`, `STORY_TRANSLATE_RATE_LIMITED`, `STORY_TRANSLATE_THREAD_ID_INVALID`, `STORY_TRANSLATE_BLOCKED_OUTPUT`, `AI_SERVICE_NOT_CONFIGURED`, `AI_DAILY_BUDGET_EXCEEDED`, `BEADS_INSUFFICIENT`, `THREAD_NOT_FOUND`, `STORY_TRANSLATE_FAILED`

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
  - `GET /api/v1/auth/providers` 응답에서 provider별 `enabled`/`reason` 확인
    - `disabled_in_supabase_auth_settings`: Supabase Auth에서 provider 비활성
    - `missing_in_supabase_auth_settings`: provider 구성 누락

## 🔎 `/api/v1/threads` 장애 진단

- 네트워크 탭에서 `GET /api/v1/threads` 응답 헤더 확인:
  - `x-hodam-threads-source`: `rpc` | `fallback` | `none`
  - `x-hodam-threads-degraded`: `1` 이면 일부 조회 경로가 실패했음을 의미
  - `x-hodam-threads-degraded-reasons`: `rpc_error`, `fallback_error`, `keywords_error`, `unexpected_exception` 등
- 해석 가이드:
  - `source=rpc`: 정상 RPC 경로
  - `source=fallback`: RPC 실패 후 테이블 직접 조회로 복구
  - `source=none`: RPC/복구 경로 모두 실패하여 빈 목록 응답
- 상세 조회(`GET /api/v1/threads/:id`)도 동일한 diagnostics 헤더를 사용:
  - `x-hodam-threads-source`
  - `x-hodam-threads-degraded`
  - `x-hodam-threads-degraded-reasons`
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
- **AI**: OpenAI (새 그림책 GPT-5.4, 그림 gpt-image-2.5-flare; 환경변수로 설정)
- **Styling**: Tailwind CSS
- **Development**: Cursor with MCP

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 있습니다.

## 개발 및 검증

Node.js 22 최신 패치와 npm을 사용합니다. `.nvmrc`로 버전을 맞춘 뒤 `npm ci`로 설치합니다. CI의 lint는 경고도 실패로 처리하며, `npm test`는 기존 `src`·`scripts` 테스트와 `tests`의 그림책 QA 테스트를 함께 실행합니다.

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run start
```

로컬 PostgreSQL의 `initdb`, `pg_ctl`, `psql`이 있다면 `npm run test:db`로 권한 마이그레이션을 격리된 임시 DB에서 검증할 수 있습니다. 운영 Supabase에는 연결하지 않습니다.

## API 구성

- 새 8쪽 그림책의 생성·결말·삽화는 `src/app/api/story-actions.ts`의 인증된 서버 액션을 사용합니다. 이전 동화와 `/api/v1/story/*` API도 유지합니다.
- `/bedtime-stories`와 `/bedtime-stories/[slug]`는 로그인 없이 읽는 창작 동화 3편을, `/ai-storybook`은 제작 방법과 이용 조건을 제공합니다. 공개 원고는 `src/content/public-stories.ts`, 대표 삽화는 `public/stories/*.webp`에 보관하며 열람할 때 AI API를 호출하지 않습니다.
- 계정·책장·결제 화면은 기존 `/api/v1` 클라이언트와 API 계약을 사용합니다. `/api/routes/payment/confirm`도 같은 v1 승인 핸들러로 연결됩니다.
- 결제 승인·상태 복구·웹훅은 공급자 확인과 공통 지급 처리를 사용합니다. 웹훅 주소는 `/api/v1/payments/webhook`입니다.
- 개인 책의 그림과 프로필은 비공개 버킷의 서명 URL로 표시합니다. 이전 동화의 중첩 경로와 새 그림책 경로를 함께 지원하며, 새 프로필은 만료되는 URL 대신 저장소 경로를 보관합니다.

## 그림책과 결제 설정

`.env.example`에 필요한 항목을 정리했습니다. OpenAI 키는 서버 환경변수 `OPENAI_API_KEY`로만 설정합니다. 기존 `OPEN_AI_API_KEY`도 호환되지만 공개 빌드 설정에 넣지 않습니다. 초안 모델은 `OPENAI_STORY_MODEL`, 독립 검수·부분 교정 모델은 `OPENAI_STORY_REVIEW_MODEL`로 분리합니다. 두 기본값은 검증한 `gpt-5.4-2026-03-05` snapshot이며 서로 별도 요청으로 실행합니다. 검수에 실패한 원고는 저장하지 않고, 지적된 쪽을 한 번 교정한 뒤 전체를 다시 검수합니다. [그림책 품질 운영 가이드](docs/picturebook-quality.md)에 통과 기준과 `npm run qa:picturebook -- --run-live --fixtures` 유료 회귀 평가를 정리했습니다.

그림 모델은 `OPENAI_IMAGE_MODEL`로 설정합니다. 기본은 `gpt-image-2.5-flare`이며 1024×1024, low 품질을 사용합니다. 새 책은 인물·의상·소품의 공통 외형을 저장하고 각 쪽의 그림 요청에 함께 전달합니다.

결제에는 `SUPABASE_SERVICE_ROLE_KEY`, `TOSS_PAYMENTS_SECRET_KEY`, `NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY`가 모두 필요합니다. 누락되면 `/api/routes/payment/config`는 `enabled: false`를 반환하고 충전 버튼은 비활성화됩니다. 이 문서는 운영 키 설정 완료를 의미하지 않습니다. 서비스 역할 키는 생성 저장 실패 시 자동 복구에도 필요하며 서버 환경에만 설정합니다. OAuth 리다이렉트 허용 목록에는 배포 도메인의 `/auth/callback`과 사용 중인 로컬 주소를 등록합니다.

4월 마이그레이션 이력이 반영된 기존 DB에 호환 서버를 배포한 뒤, 같은 릴리스에서 아래 두 마이그레이션을 순서대로 적용합니다. `npm run build`나 Vercel 배포는 SQL을 자동 적용하지 않습니다.

1. `20260914010000_harden_hodam_accounting.sql`: 회계 권한과 생성 요청 중복을 제어하고 운영 권한 스모크 검사도 갱신합니다. 기존 그림책 요청 ID 중복이 있으면 적용이 중단되므로 먼저 확인합니다.
2. `20260914020000_private_picturebook_storage.sql`: `image`·`profiles`를 비공개로 설정하고 새 경로와 기존 사용자별 경로에 소유권 정책을 적용합니다.

적용 전 서버 키와 DB 이력, 복구 가능한 백업을 확인하고 적용 후 권한 검사·기존 책 삽화·프로필·결제를 확인합니다. 적용 후에는 공개 object URL과 이전 브라우저 결제에 의존하는 버전으로 코드만 되돌릴 수 없습니다. 호환 버전을 유지하는 복구 절차는 [배포 체크리스트](DEPLOYMENT_CHECKLIST.md)를 따릅니다.

[서비스 개선 기록](docs/2026-09-14-service-review.md)과 [2차 QA 기록](docs/2026-09-14-qa-followup.md)은 통합 전 검증 이력입니다. 당시 신규 AI 생성 성공 검증은 API 이용 한도로 완료하지 못했으므로, 실제 배포 완료 여부와 공급자 검증 결과는 해당 릴리스의 배포 기록에서 확인합니다.

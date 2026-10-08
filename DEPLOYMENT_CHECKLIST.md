# HODAM 프로덕션 배포 체크리스트

이 문서는 실제 배포 직전/직후에 바로 사용할 수 있는 체크리스트입니다.
문서 기준일: 2026-10-06 (빌드 설치 요건·그림책 생성 설정 동기화; 실제 검증 범위는 릴리스 기록 기준)

관련 런북:

- `SUPABASE_MANUAL_RUNBOOK.md`
- `POST_DEPLOY_SMOKE_RUNBOOK.md`
- `SECURITY_HARDENING_NEXT_STEPS.md`

## 1) 배포 전 필수 게이트

- [ ] `.nvmrc`의 Node.js 22 최신 패치와 npm으로 개발 의존성을 포함한 `npm ci` 완료 (`NODE_ENV=production` 설치 환경은 `npm ci --include=dev`)
- [ ] `OPENAI_API_KEY=dummy npm run check:all` 통과 (lint 경고 0, 기존·그림책 테스트 포함)
- [ ] `npm run typecheck` 통과
- [ ] `npm run build`의 공개 환경변수 검사와 공개 산출물 검사 통과 (검사를 생략하거나 우회하지 않음)
- [ ] `npm run test:db` 통과 (로컬 `initdb`, `pg_ctl`, `psql` 필요, 운영 DB 연결 없음)
- [ ] `npm run check:supabase:security:strict:baseline` 통과
- [ ] `npm run check:oauth -- --runtime-origin=https://<production-domain>` 통과
- [ ] `npm run test:e2e:auth:local` 통과
- [ ] `npm run test:e2e:payments:local` 통과

로컬 모의 공급자 검증과 실제 운영 공급자 검증을 구분해 기록합니다. 이전 QA의 테스트 수나 빌드 성공은 현재 통합본의 검증을 대신하지 않습니다. `strict:baseline`의 예외 목록에 포함된 서버 키 항목도 아래 릴리스 준비 단계에서는 직접 확인합니다.

## 2) 프로덕션 환경변수

### Required

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-key-or-legacy-anon-key>
OPENAI_API_KEY=<openai-key>
SUPABASE_SERVICE_ROLE_KEY=<secret-key-or-legacy-service-role-key>
NEXT_PUBLIC_SITE_URL=https://<production-domain>
NEXT_PUBLIC_AUTH_REDIRECT_URL=https://<production-domain>/auth/callback
```

서비스 역할 키는 새 그림책의 원자적 저장, 서버 결제와 기존 v1 생성 실패 복구에 필요합니다. 브라우저 공개 설정에 넣지 않습니다. 운영 배포에 실제 설정되어 있는지 별도로 확인합니다. `NEXT_PUBLIC_SUPABASE_ANON_KEY`에는 `sb_publishable_` 키 또는 role이 anon인 legacy JWT만 허용합니다. 서버 변수에는 `sb_secret_` 또는 service_role 키를 사용합니다.

키 교체 시 새 publishable/secret 키를 사용하는 배포를 먼저 검증하고, Supabase API Keys에서 기존 legacy 키를 비활성화합니다. 새 키 생성만으로 기존 키가 폐기되지는 않습니다. 값은 로그·PR·보고서에 기록하지 않습니다. [공식 교체 절차](https://supabase.com/docs/guides/getting-started/api-keys)를 따릅니다.

### 결제 활성화에 추가로 필수

```bash
TOSS_PAYMENTS_SECRET_KEY=<toss-secret-key>
NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY=<toss-client-key>
```

세 가지 결제 키 중 하나라도 없으면 `/api/routes/payment/config`는 `enabled: false`를 반환합니다. 키가 없는 상태를 결제 준비 완료로 표시하지 않습니다.

### 모델·운영 도구 설정

```bash
OPENAI_STORY_MODEL=gpt-5.4-2026-03-05
OPENAI_STORY_REVIEW_MODEL=gpt-5.4-2026-03-05
OPENAI_IMAGE_MODEL=gpt-image-2.5-flare
SUPABASE_ACCESS_TOKEN=<supabase-personal-access-token>
SUPABASE_PROJECT_REF=<project-ref>
TOSS_PAYMENTS_WEBHOOK_SECRET=<webhook-secret-header-value>
TOSS_PAYMENTS_WEBHOOK_HMAC_SECRET=<webhook-hmac-secret>
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
- [ ] 승인·상태 복구·웹훅의 공급자 확인 및 중복 지급 방지 검증
- [ ] 공급자/DB 일시 장애 이후 같은 전달 ID로 재시도되는지 확인

## 5) Supabase 수동 운영 항목

- [ ] 연결한 프로젝트와 4월 마이그레이션 적용 이력 확인
- [ ] 배포 전 백업/복구 가능 상태와 기존 그림책 요청 ID 중복 여부 확인
- [ ] 서비스 역할 키 및 서명 URL을 지원하는 통합 서버를 먼저 배포하고 준비 상태 확인
- [ ] `20260914010000_harden_hodam_accounting.sql` 적용
- [ ] `20260914020000_private_picturebook_storage.sql` 적용
- [ ] 원자적 그림책 저장 앱 배포 전 `20261006010000_commit_picturebook_atomically.sql` 적용, 서버 역할 `picturebook_storage_ready()` true 및 두 함수의 서버 전용 권한 확인
- [ ] 완독 반응 UI 배포 전 `20261008010000_reading_feedback.sql` 적용, 본인 책 읽기·저장·수정과 타 계정 접근 거부 확인 (`docs/reading-feedback.md`)
- [ ] `20261008020000_narrow_security_definer_grants.sql` 적용 후 웹훅 등록·운영 점검 RPC의 클라이언트 실행 차단 및 보안 기준 검사 통과 확인 (`docs/security-definer-review.md`)
- [ ] `hodam_security_grants_smoke_check`와 보안 점검이 새 회계 권한 기준으로 통과
- [ ] `image`·`profiles` 비공개 상태, 새 그림책/기존 중첩 경로의 소유자 접근 확인
- [ ] Postgres 패치 업그레이드 (`vulnerable_postgres_version`)
- [ ] leaked password protection(HIBP) 플랜 지원 여부 확인 후 활성화
- [ ] 적용 절차는 `SUPABASE_MANUAL_RUNBOOK.md` 기준으로 수행

SQL은 빌드나 Vercel 배포로 자동 적용되지 않습니다. 코드와 DB 반영을 같은 릴리스의 완료 조건으로 관리합니다. 9월 마이그레이션은 기존 4월 스키마를 전제로 하므로 빈 DB의 초기 스키마 생성용으로 사용하지 않습니다. 10월 원자적 저장 migration은 9월 회계 보호가 적용된 DB에 먼저 추가하고 앱을 전환합니다. 기존 미확인 예약 행을 자동 환불하거나 삭제하지 않습니다.

## 6) 모니터링/알림

- [ ] Sentry 프로젝트 연결 및 알림 채널 구성
- [ ] request-id 기반 이슈 역추적 가능 여부 확인
- [ ] 결제 실패율/웹훅 오류율 대시보드 점검

## 7) 배포 직후 스모크

- [ ] `POST_DEPLOY_SMOKE_RUNBOOK.md` 체크리스트 완료
- [ ] (Postgres 패치 완료 시) `npm run check:supabase:security:strict:post-upgrade` 통과
- [ ] `/sample`, 로그인/OAuth 콜백, 계정 변경·로그아웃 확인
- [ ] 4쪽 생성 → 행동 선택 → 8쪽 완성 → 책장에서 다시 읽기 및 삽화 확인
- [ ] 이전 동화 본문·중첩 경로의 삽화, 기존/신규 프로필 사진 확인
- [ ] PDF 표지·한글·삽화·마지막 쪽, 그림 누락 안내, 계정별 즐겨찾기·책갈피·단짝별 책장 및 잠자리 모드 확인
- [ ] 결제 준비 상태, 승인·상태 재확인·내역·웹훅 핵심 플로우 검증
- [ ] 유지한 v1 동화·번역·TTS 계약 점검
- [ ] `x-request-id` 확인 가능한 샘플 장애 로그 확보

OpenAI 모델 접근 권한·API 이용 한도와 Toss 운영 설정은 모의 응답 테스트로 확인되지 않습니다. 실제 생성 또는 결제 검증을 수행하지 못했다면 원인과 미검증 범위를 배포 기록에 남깁니다.

## 8) 롤백 기준

- [ ] 결제 승인/지급 불일치 발생
- [ ] 그림책 서버 액션, `/api/v1/threads` 또는 `/api/v1/story/*` 연속 실패
- [ ] 로그인 콜백 정체/무한 로딩 재현
- [ ] 위 항목 발생 시 해당 기능을 제한하고 DB 호환성을 확인한 안정 배포로 복구

9월 SQL 적용 이후에는 공개 URL·이전 브라우저 결제에 의존하는 과거 버전으로 코드만 롤백하면 계정·결제·이미지가 동작하지 않을 수 있습니다. 서버 전용 회계와 서명 URL을 지원하는 버전으로 복구하거나 현재 버전을 수정해 배포합니다. 회계 권한을 다시 공개하거나 버킷을 공개로 되돌리는 조치를 일반 롤백 절차로 사용하지 않습니다.

### Vercel Hobby 실행 시간

현재 프로젝트의 함수 한도는 60초다. 생성·책장 레이아웃의 `maxDuration`도 60으로 유지한다. 시작·결말 생성은 각각 작성·검수·교정·재검수 최대 4회 호출에 50초를 공유하며, 개별 상한은 작성 18초·검수 20초·교정 18초다. 삽화 요청은 별도로 45초로 제한한다. 검수 오류나 교정 후 미달인 원고는 저장하지 않고, 결말 실패 시 이미 저장된 앞 4쪽을 보존한다. 세부 조건은 [그림책 품질 운영 가이드](docs/picturebook-quality.md)를 따른다.

프로필 사진은 인증된 사용자 범위의 서버 클라이언트와 저장소 소유자 정책으로 처리한다. 서비스 역할 키 없이도 본인의 사진만 업로드·서명·삭제할 수 있다. Toss 및 서비스 역할 키가 없는 환경에서는 충전 기능이 준비 중으로 표시된다.

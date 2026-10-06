# Supabase 수동 작업 런북

적용 기준일: 2026-04-06

목적:
- 코드로 자동화 불가능한 Supabase 대시보드 작업을 안전하게 수행
- 운영 중단 시간을 최소화하고 검증 절차를 표준화

## 1) 사전 확인

1. 현재 advisor 상태 확인
- `npm run check:supabase:security`
- `npm run check:supabase:performance`
- `npm run check:supabase:performance:report` (unused index 분류 리포트)
- 남은 경고:
- `auth_leaked_password_protection`
- `vulnerable_postgres_version`

2. 사전 백업/복구 계획
- Supabase 백업 정책 확인
- 긴급 롤백 담당자/시간대 확정

## 2) Postgres 보안 패치 업그레이드

1. 대시보드 경로
- Supabase Dashboard -> Project Settings -> Infrastructure / Database upgrade

2. 실행 전 체크
- 최근 24시간 오류율/결제 이벤트 지표 확인
- 배포/트래픽 저점 시간대 지정

3. 업그레이드 수행
- 최신 보안 패치 버전으로 업그레이드
- 진행 중 API 5xx 모니터링

4. 업그레이드 후 즉시 검증
- `npm run build`
- `npm run check:supabase:security`
- `npm run check:supabase:performance`
- 결제 1회 + 동화 생성 1회 E2E
- 통합 검증 커맨드:
- `npm run check:post-upgrade -- --runtime-origin=https://<production-domain>`
- (Postgres patch upgrade 이후 권장)
- `npm run check:post-upgrade -- --runtime-origin=https://<production-domain> --post-db-upgrade`
- strict 게이트:
- `npm run check:supabase:security:strict:post-upgrade`

## 3) Leaked Password Protection(HIBP)

1. 대시보드 경로
- Supabase Dashboard -> Authentication -> Password Security

2. 활성화 조건
- 현재 플랜에서 HIBP 기능이 지원되어야 함
- 미지원 시:
- 플랜 업그레이드 계획 수립
- CI baseline ignore 유지 (`auth_leaked_password_protection`)

3. 활성화 후 검증
- `npm run check:supabase:security`
- `npm run check:supabase:security:strict` (ignore 제거 후)

## 4) CI strict ignore 제거 순서

기본 ignore:
- `auth_leaked_password_protection`
- `vulnerable_postgres_version`

제거 절차:
1. 해당 이슈 수동 해결
2. `HODAM_SUPABASE_SECURITY_IGNORE_LINTS`에서 항목 제거
3. `npm run check:supabase:security:strict` 통과 확인
4. CI에서 strict 통과 확인

## 5) 실패 대응

업그레이드/보안설정 변경 후 아래 중 하나면 즉시 복구 판단:
- 결제 승인/웹훅 처리 연속 실패
- 인증 콜백 장애
- `/api/v1/threads` 5xx 급증

복구 액션:
1. 마지막 안정 설정/버전으로 복구
2. `POST_DEPLOY_SMOKE_RUNBOOK.md` 재실행
3. 장애 원인/재시도 계획 기록

## 6) 그림책 첫 원고의 원자적 저장

`20261006010000_commit_picturebook_atomically.sql`은 첫 4쪽 원고 저장, 곶감 1개 사용, 사용 장부를 한 트랜잭션으로 처리한다. 새 예약 행을 먼저 저장한 뒤 별도로 차감하던 단계는 새 앱에서 제거한다. 결말·삽화 생성, 기존 동화와 결제 RPC는 그대로 유지한다.

적용 순서:

1. `npm run test:db`로 격리 DB 권한·롤백·동시 요청·프로세스 종료 검증을 통과한다. 이 명령은 운영 DB에 연결하지 않는다.
2. 운영의 `thread.raw_text`가 text, `bead.count`가 bigint인지와 사용자/요청별 고유 인덱스를 확인한다. 이 구조는 2026-10-06 운영에서 읽기 전용 조회로 확인했다.
3. 위 migration을 앱보다 먼저 적용하고 적용 이력을 남긴다. 기존 행 수정·삭제는 포함하지 않는다.
4. 서버 역할로 `picturebook_storage_ready()`가 true인지 확인하고 `hodam_security_grants_smoke_check()`의 새 두 함수 권한을 확인한다. 두 함수 모두 anon·authenticated 실행은 금지하고 service_role만 허용한다.
5. 서버 `SUPABASE_SERVICE_ROLE_KEY`가 설정된 앱을 배포한다. 앱은 사용자 세션을 검증해 얻은 ID만 전달하며, 준비 확인이 실패하면 AI 호출과 일일 한도 사용 전에 종료한다.
6. 표시된 QA 계정으로 같은 요청의 중복 저장이 같은 책·잔액을 반환하는지 확인한다. 실제 AI 원고·삽화 검증은 별도로 기록한다.

응답이 유실되면 같은 요청 ID와 원고로 재호출한다. DB 결과가 확정되지 않았을 때 별도 환불을 시도하지 않는다. 새 함수는 실제 잔액의 1개 감소와 동일 요청의 usage(-1) 장부가 모두 일치해야 커밋한다.

기존 빈 예약 행 또는 책 없이 사용 장부만 남은 요청은 `PICTUREBOOK_REQUEST_UNRESOLVED`로 보류한다. 과거 환불 함수가 요청별 환불 장부를 남기지 않아 자동 환불·자동 완성 여부를 추정할 수 없다. 해당 사용자의 원고·잔액·운영 기록을 확인한 뒤 별도 대응한다.

롤백 시 새 함수는 남겨도 이전 앱과 공존할 수 있다. 이미 저장된 책·사용 장부를 삭제하거나 공개 실행 권한을 부여하지 않는다. 이전 앱으로 돌아가면 저장·차감 사이 중단 위험도 돌아오므로 복구 목적의 일시적 조치로만 판단한다.

# Supabase 수동 작업 런북

적용 기준일: 2026-04-06

목적:
- 코드로 자동화 불가능한 Supabase 대시보드 작업을 안전하게 수행
- 운영 중단 시간을 최소화하고 검증 절차를 표준화

## 1) 사전 확인

1. 현재 advisor 상태 확인
- `npm run check:supabase:security`
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

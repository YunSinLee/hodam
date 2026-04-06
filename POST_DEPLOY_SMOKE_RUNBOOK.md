# Post-Deploy Smoke Runbook

목적:
- 배포 직후 핵심 사용자 플로우를 빠르게 검증
- 인증/스토리/결제/보안 회귀를 조기에 탐지

## 1) 준비

- 배포 URL: `https://<production-domain>`
- 테스트 사용자 계정 확보
- 테스트 결제/웹훅 검증 환경 확보

빠른 통합 실행:

```bash
npm run check:post-upgrade -- --runtime-origin=https://<production-domain>
```

## 2) API/보안 게이트

1. 환경/빌드 게이트

```bash
OPENAI_API_KEY=dummy npm run check:all
npm run check:supabase:security:strict:baseline
```

2. OAuth 진단

```bash
npm run check:oauth -- --runtime-origin=https://<production-domain>
```

성공 기준:
- provider enabled
- google/kakao authorize redirect 302 정상

## 3) 인증/스토리 스모크

```bash
npm run test:e2e:auth:local
```

성공 기준:
- `/sign-in` 접근 가능
- CTA 렌더링
- `/api/v1/threads` 401/200 경계 정상
- `/auth/callback` 경로 정상

## 4) 결제 스모크

```bash
npm run test:e2e:payments:local
```

성공 기준:
- prepare -> confirm -> history 순서 성공
- confirm 중복 호출 idempotency 보장
- beads count 일관성 유지

## 5) 수동 UI 스모크 (5분)

1. 로그인
- Google/Kakao 로그인 1회씩

2. 스토리
- 생성 시작 -> 이어쓰기 -> 번역 -> TTS

3. 결제
- 결제 성공 1회
- 결제 내역/bead count 동기화 확인

4. 장애 추적성
- 실패 응답 헤더의 `x-request-id` 확인 가능

## 6) 실패 기준과 대응

즉시 핫픽스/롤백 고려:
- 로그인 콜백 무한 대기
- 결제 승인 후 bead 미지급
- `/api/v1/story/*` 또는 `/api/v1/threads` 5xx 지속

대응 순서:
1. `x-request-id`로 서버 로그/Sentry 추적
2. 영향 범위 산정
3. 직전 안정 배포로 롤백 여부 결정

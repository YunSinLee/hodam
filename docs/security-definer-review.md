# 클라이언트 실행 가능 DB 함수 검토 — 2026-10-08

Supabase가 추가한 `anon_security_definer_function_executable` 및 `authenticated_security_definer_function_executable` 진단은 클라이언트가 권한 상승 함수에 접근할 수 있음을 알린다. 공개 실행이 필요한지, 함수 내부에서 요청 범위를 제한하는지를 개별적으로 검토해야 한다. 두 진단 이름 전체를 무시하지 않는다.

운영 DB의 `pg_get_functiondef`, 역할별 `has_function_privilege`, 저장소 호출 코드를 읽었다. 아래 목록은 schema·함수 이름·인자 선언·역할이 일치하는 7개 함수/9개 권한에만 적용한다. 다른 스키마, 오버로드, 익명 역할로의 권한 확대, 새로운 함수 및 메타데이터 누락은 strict 검사에서 실패한다. 허용된 함수라도 `ERROR`나 다른 종류의 진단이면 실패한다. 함수 본문을 변경할 때는 이 검토와 소유권 회귀 테스트도 다시 확인해야 한다.

## 실제 회수한 권한

`20261008020000_narrow_security_definer_grants.sql`:

- `register_webhook_transmission(text,text,text,timestamptz,integer)`의 PUBLIC·anon·authenticated 실행 권한을 회수한다. 호출처는 서명 검증을 통과한 `/api/v1/payments/webhook`의 서비스 역할뿐이다. 기존 함수 본문은 소유권을 검사하지 않아 일반 회원이 전송 ID를 먼저 등록할 수 있었다. 서비스 역할의 등록 및 중복 방지는 유지한다.
- `handle_new_user()`의 PUBLIC·anon·authenticated 권한을 회수한다. 기존 가입 트리거를 제거하거나 교체하지 않는다. PostgreSQL 트리거 호출은 계속 작동함을 격리 DB에서 확인한다.
- `hodam_security_smoke_check()`, `hodam_security_grants_smoke_check()`, `hodam_security_integrity_smoke_check()`는 운영 점검 전용으로 서비스 역할만 허용한다. 점검 스크립트도 기존부터 서비스 역할로 호출한다.
- 오래된 기본 smoke 검사에서 회원의 `finalize_payment` 실행 권한을 요구하던 항목을 실행 불가 확인으로 맞춘다. 2026-09 회계 보안 경계와 동일한 판정이다.

## 남기는 정확한 권한

아래 함수는 모두 `public` 스키마다. 인자 이름까지 포함한 매칭 목록은 `scripts/lib/reviewed-security-definers.mjs`에 있다.

| 함수와 SQL 인자 타입 | 허용 역할 | 현재 본문에서 확인한 제한 / 사용처 |
| --- | --- | --- |
| `consume_beads(uuid,integer,text)` | authenticated | `HODAM_OWNERSHIP_GUARD`: 서비스 역할을 제외하면 `auth.uid()`가 존재하고 `p_user_id`와 같아야 한다. 비용 음수 거절, 잔액 조건부 차감, 요청 ID 중복 처리. 기존 생성/회계 흐름. |
| `consume_daily_quota(uuid,text,integer,integer,jsonb)` | authenticated | 동일 소유권 검사. 다른 계정의 할당량 기록 불가. 동시 호출 잠금과 누적 사용량 비교. API의 생성/삽화 할당량 제한. |
| `get_my_threads()` | authenticated | 모든 행에 `t.user_id = auth.uid()` 조건. `threads` API의 내 책 목록. |
| `get_thread_detail(bigint)` | authenticated | ID와 `t.user_id = auth.uid()` 조건으로 소유한 책만 선택하고 메시지/선택지 역시 해당 책을 통해 조회. 상세 API. |
| `get_payment_webhook_transmissions(text,uuid)` | authenticated | 서비스 역할 이외에는 `auth.uid()`를 강제하고 다른 `p_user_id` 또는 null 사용자를 거절. `payment_history`와 조인 후 주문 소유자 필터. 개인 결제 타임라인. |
| `get_auth_callback_metrics_by_attempt(text,integer)` | anon, authenticated | 로그인 전 오류 진단을 위한 의도된 예외. 8–128자 제한된 문자 집합의 정확한 attempt ID, 최근 24시간, 허용된 callback action만 최대 61행 조회. 목록 탐색·회원 데이터/책 조회 권한을 주지 않는다. `/auth/callback/metrics/recent`의 공개 키 fallback. |
| `record_auth_callback_metric(text,text,bigint,jsonb)` | anon, authenticated | 로그인 전 계측을 위한 의도된 예외. 허용된 stage, callback 경로, 시각 범위 검사. 세부 값은 필드 허용 목록과 길이/범위 검사를 거쳐 저장하고 임의 필드는 버린다. 계정 잔액이나 책을 변경하지 않는다. `/auth/callback/metrics`의 공개 키 fallback. |

로그인 전 두 RPC는 인증에 묶인 개인 데이터 API가 아니다. attempt ID를 아는 사람은 해당 진단을 조회할 수 있고, 공개 쓰기에는 서버 API의 IP 제한을 우회한 직접 호출이 가능하다. 그러므로 이 채널에 아이 정보·본문·비밀값을 추가하면 안 된다. 이 검토는 공개 계측의 존재를 명시적으로 수용한 것이며, 스팸 방어가 완전하다는 뜻이 아니다. 민감 항목을 추가하거나 계측 범위를 넓힐 때는 서버 전용 전환과 별도 제한을 먼저 검토한다.

## 검증

- 관리 API의 단일 진단 형식과 `findings` 그룹 형식을 모두 펼쳐 각 함수를 검사한다. 알고 있는 함수 하나가 포함됐다는 이유로 그룹 전체를 통과시키지 않는다.
- strict CLI 회귀 테스트는 합성 응답만 사용한다. 새 함수/역할/오버로드/다른 스키마/메타데이터 누락/더 강한 진단을 거절한다. 환경변수로 두 진단 이름을 통째로 무시하더라도 미검토 함수는 실패한다.
- 익명 RPC 점검은 운영 smoke·webhook 등록의 차단도 확인한다. `handle_new_user`는 트리거 반환 함수여서 PostgREST RPC에 노출되지 않으므로 HTTP 검사 대상에 넣지 않고, DB의 역할별 EXECUTE assertion과 advisor에서 권한 회수를 확인한다. 일반 RPC의 404를 권한 차단으로 간주하지 않는다. 공개 계측 쓰기 점검은 잘못된 stage를 사용하여 진단 행을 실제 생성하지 않는다.
- 격리 PostgreSQL에서 마이그레이션 2회 적용, webhook 선점 차단과 서비스 역할 중복 처리, 가입 트리거 유지, 다른 사용자의 책·결제 읽기 차단, callback attempt 범위와 필드 필터를 확인한다. 기존 차감/할당량의 타인 ID 거절 테스트도 계속 실행한다.

진단 기준: [공개 권한 상승 함수](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [회원 권한 상승 함수](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). 검토 기록과 일치하는 경고도 로그에 `reviewed`와 이유를 남겨 운영자가 확인할 수 있게 한다.

# Supabase Unused Index Report

- project_ref: zdvnlojkptjgalxgcqxa
- unresolved_unused_indexes: 16
- drop_candidate: 2
- keep_candidate: 13
- review: 1

| table | index | columns | classification | confidence | reason |
| --- | --- | --- | --- | --- | --- |
| bead_transactions | idx_bead_transactions_created_at | created_at | keep_candidate | high | 코드/SQL에서 관련 컬럼 접근 패턴이 관찰되어 유지 가능성이 높습니다. |
| bead_transactions | idx_bead_transactions_user_id | user_id | keep_candidate | high | 코드/SQL에서 관련 컬럼 접근 패턴이 관찰되어 유지 가능성이 높습니다. |
| image | idx_image_thread_id | thread_id | keep_candidate | high | 코드/SQL에서 관련 컬럼 접근 패턴이 관찰되어 유지 가능성이 높습니다. |
| keywords | idx_keywords_keyword | keyword | review | low | 쿼리 패턴 근거가 부족해 수동 검토가 필요합니다. |
| messages | idx_messages_created_at | created_at | keep_candidate | high | 코드/SQL에서 관련 컬럼 접근 패턴이 관찰되어 유지 가능성이 높습니다. |
| payment_history | idx_payment_history_created_at | created_at | keep_candidate | high | 코드/SQL에서 관련 컬럼 접근 패턴이 관찰되어 유지 가능성이 높습니다. |
| payment_history | idx_payment_history_status | status | keep_candidate | high | 코드/SQL에서 관련 컬럼 접근 패턴이 관찰되어 유지 가능성이 높습니다. |
| payment_history | idx_payment_history_user_id | user_id | drop_candidate | high | 동일 테이블에서 선두 컬럼이 같은 확장 인덱스(payment_history_user_created_at_idx)가 있어 중복 가능성이 높습니다. |
| user_activity_logs | idx_user_activity_logs_created_at | created_at | keep_candidate | high | 코드/SQL에서 관련 컬럼 접근 패턴이 관찰되어 유지 가능성이 높습니다. |
| user_activity_logs | idx_user_activity_logs_user_id | user_id | drop_candidate | high | 동일 테이블에서 선두 컬럼이 같은 확장 인덱스(user_activity_logs_user_action_created_at_idx)가 있어 중복 가능성이 높습니다. |
| user_activity_logs | user_activity_logs_user_action_created_at_idx | user_id, action, created_at | keep_candidate | high | 코드/SQL에서 관련 컬럼 접근 패턴이 관찰되어 유지 가능성이 높습니다. |
| messages | messages_thread_turn_id_idx | thread_id, turn, id | keep_candidate | high | 코드/SQL에서 관련 컬럼 접근 패턴이 관찰되어 유지 가능성이 높습니다. |
| payment_history | payment_history_user_created_at_idx | user_id, created_at | keep_candidate | high | 코드/SQL에서 관련 컬럼 접근 패턴이 관찰되어 유지 가능성이 높습니다. |
| bead_transactions | bead_transactions_thread_id_idx | thread_id | keep_candidate | high | 코드/SQL에서 관련 컬럼 접근 패턴이 관찰되어 유지 가능성이 높습니다. |
| user_activity_logs | user_activity_logs_action_created_at_idx | action, created_at | keep_candidate | high | 코드/SQL에서 관련 컬럼 접근 패턴이 관찰되어 유지 가능성이 높습니다. |
| payment_webhook_transmissions | payment_webhook_transmissions_created_at_idx | created_at | keep_candidate | high | 코드/SQL에서 관련 컬럼 접근 패턴이 관찰되어 유지 가능성이 높습니다. |

## Notes
- 이 리포트는 Supabase advisor 결과와 코드베이스 정적 패턴 기반의 자동 분류입니다.
- 실제 삭제 전에는 `EXPLAIN ANALYZE`와 운영 트래픽 구간 재확인이 필요합니다.
- `drop_candidate`는 자동 삭제되지 않으며, 수동 마이그레이션으로만 정리해야 합니다.
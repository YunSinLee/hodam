# Supabase Unused Index Report

- project_ref: zdvnlojkptjgalxgcqxa
- unresolved_unused_indexes: 4
- drop_candidate: 0
- keep_candidate: 4
- review: 0

| table | index | columns | classification | confidence | reason |
| --- | --- | --- | --- | --- | --- |
| bead_transactions | idx_bead_transactions_user_id | user_id | keep_candidate | high | 코드/SQL에서 관련 컬럼 접근 패턴이 관찰되어 유지 가능성이 높습니다. |
| messages | messages_thread_turn_id_idx | thread_id, turn, id | keep_candidate | high | 코드/SQL에서 관련 컬럼 접근 패턴이 관찰되어 유지 가능성이 높습니다. |
| bead_transactions | bead_transactions_thread_id_idx | thread_id | keep_candidate | high | 코드/SQL에서 관련 컬럼 접근 패턴이 관찰되어 유지 가능성이 높습니다. |
| image | idx_image_thread_id | thread_id | keep_candidate | high | 코드/SQL에서 관련 컬럼 접근 패턴이 관찰되어 유지 가능성이 높습니다. |

## Notes
- 이 리포트는 Supabase advisor 결과와 코드베이스 정적 패턴 기반의 자동 분류입니다.
- 실제 삭제 전에는 `EXPLAIN ANALYZE`와 운영 트래픽 구간 재확인이 필요합니다.
- `drop_candidate`는 자동 삭제되지 않으며, 수동 마이그레이션으로만 정리해야 합니다.
import styles from "./reading-sync-notice.module.css";

interface ReadingSyncNoticeProps {
  status: "loading" | "syncing" | "synced" | "offline" | "error" | "conflict";
  pendingCount: number;
  legacyCount: number;
  localOnlyCount?: number;
  storageAvailable: boolean;
  retry: () => void;
  importLegacy: () => void;
  dismissLegacy: () => void;
}

export default function ReadingSyncNotice({
  sync,
  compact = false,
}: {
  sync: ReadingSyncNoticeProps;
  compact?: boolean;
}) {
  const {
    status,
    pendingCount,
    legacyCount,
    localOnlyCount = 0,
    storageAvailable,
    retry,
    importLegacy,
    dismissLegacy,
  } = sync;
  const needsRetry = status === "error" || status === "offline";
  let message = "책갈피와 좋아하는 책을 다른 기기에서도 이어볼 수 있어요.";
  if (status === "loading") message = "계정의 읽기 기록을 확인하고 있어요.";
  if (status === "syncing") message = "읽기 기록을 계정에 저장하고 있어요.";
  if (status === "offline")
    message = pendingCount
      ? "연결이 돌아오면 남겨둔 읽기 기록을 저장할게요."
      : "연결이 끊겨 이 기기에 남은 기록을 보여드려요.";
  if (status === "error")
    message = "읽기 기록을 연결하지 못했어요. 다시 시도해 주세요.";
  if (status === "conflict")
    message = "책이나 읽기 기록이 바뀌어 이번 변경을 저장하지 않았어요.";

  return (
    <div className={`${styles.notice} ${compact ? styles.compact : ""}`}>
      <div className={styles.line}>
        <p role={needsRetry || status === "conflict" ? "status" : undefined}>
          {message}
        </p>
        {needsRetry && (
          <button type="button" className="text-link" onClick={retry}>
            기록 다시 연결
          </button>
        )}
      </div>
      {!storageAvailable && (
        <p className={styles.warning} role="status">
          이 브라우저는 임시 저장을 막고 있어요. 계정에 저장되기 전에 화면을
          닫으면 최근 기록이 사라질 수 있어요.
        </p>
      )}
      {legacyCount > 0 && (
        <aside
          className={styles.legacy}
          aria-label="이 브라우저의 예전 읽기 기록"
        >
          <div>
            <strong>이 브라우저에 남은 기록 · {legacyCount}권</strong>
            <p>
              계정에 옮기면 다른 기기에서도 볼 수 있어요. 계정에 이미 있는
              기록은 유지해요.
            </p>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className="button-secondary"
              disabled={status !== "synced" && status !== "conflict"}
              onClick={importLegacy}
            >
              계정에 옮기기
            </button>
            <button type="button" className="text-link" onClick={dismissLegacy}>
              지금은 안 할게요
            </button>
          </div>
        </aside>
      )}
      {legacyCount === 0 && localOnlyCount > 0 && (
        <p>예전 기록 {localOnlyCount}권은 아직 이 브라우저에만 남아 있어요.</p>
      )}
    </div>
  );
}

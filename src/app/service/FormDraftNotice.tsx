/* eslint-disable react/jsx-no-bind */
import { useId, useRef, useState } from "react";

import styles from "./FormDraftNotice.module.css";

export type FormDraftStatus =
  | "none"
  | "saved"
  | "restored"
  | "unavailable"
  | "clear-failed";

const messages: Record<FormDraftStatus, string> = {
  none: "작성 내용은 이 탭에 잠시 보관돼요",
  saved: "작성 내용을 이 탭에 보관했어요",
  restored: "작성하던 이야기를 불러왔어요",
  unavailable: "이 브라우저에 작성 내용을 보관하지 못했어요",
  "clear-failed": "화면은 비웠지만 보관한 내용은 지우지 못했어요",
};

export default function FormDraftNotice({
  status,
  onClear,
}: {
  status: FormDraftStatus;
  onClear: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const clearButton = useRef<HTMLButtonElement>(null);
  const confirmId = useId();
  let help =
    "마지막 수정 후 2시간 동안, 같은 탭에서 이어 쓸 수 있어요. 다른 기기에는 옮겨지지 않아요.";
  if (status === "clear-failed")
    help =
      "다시 방문하면 이전 내용이 나타날 수 있어요. 임시 보관 비우기를 다시 시도해주세요.";
  if (status === "unavailable")
    help =
      "페이지를 나가면 최근 입력이 사라질 수 있어요. 브라우저의 사이트 저장 설정을 확인해주세요.";
  return (
    <aside className={styles.notice} aria-label="작성 내용 임시 보관">
      <div className={styles.row}>
        <div>
          <p role="status" className={styles.status}>
            {messages[status]}
          </p>
          <p className={styles.help}>{help}</p>
        </div>
        {status !== "none" && (
          <button
            type="button"
            className={styles.clear}
            ref={clearButton}
            aria-expanded={confirm}
            aria-controls={confirmId}
            onClick={() => setConfirm(value => !value)}
          >
            임시 보관 비우기
          </button>
        )}
      </div>
      {confirm && (
        <div className={styles.confirm} id={confirmId}>
          <p>
            일상·모험의 작성 내용을 모두 비울까요? 책장에 저장한 책은
            그대로예요.
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setConfirm(false);
                clearButton.current?.focus();
              }}
            >
              계속 작성하기
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setConfirm(false);
                onClear();
              }}
            >
              작성 내용 비우기
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

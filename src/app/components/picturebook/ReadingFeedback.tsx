"use client";

import { useEffect, useId, useRef, useState } from "react";

import readingFeedbackApi from "@/lib/client/api/reading-feedback";
import {
  feedbackReasonOptions,
  type FeedbackRating,
  type FeedbackReason,
  type SavedReadingFeedback,
} from "@/lib/picturebook/reading-feedback";

import styles from "./ReadingFeedback.module.css";

interface ReadingFeedbackProps {
  threadId: number;
  ownerId: string;
}

function FeedbackForm({ threadId, ownerId }: ReadingFeedbackProps) {
  const titleId = useId();
  const [saved, setSaved] = useState<SavedReadingFeedback | null>(null);
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [reason, setReason] = useState<FeedbackReason | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const request = useRef<AbortController | null>(null);
  const saveLock = useRef(false);
  const focusAfterSave = useRef(false);
  const editButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    readingFeedbackApi
      .get(threadId, ownerId, controller.signal)
      .then(({ feedback }) => {
        if (controller.signal.aborted) return;
        setSaved(feedback);
        setRating(feedback?.rating ?? null);
        setReason(feedback?.reason ?? null);
        setEditing(!feedback);
        setLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setError("이전 반응을 불러오지 못했어요. 다시 확인해 주세요.");
        setLoading(false);
      });
    return () => request.current?.abort();
  }, [ownerId, threadId, retry]);

  useEffect(() => {
    if (!editing && focusAfterSave.current) {
      editButton.current?.focus();
      focusAfterSave.current = false;
    }
  }, [editing]);

  function chooseRating(nextRating: FeedbackRating) {
    if (rating !== nextRating) setReason(null);
    setRating(nextRating);
    setError("");
  }

  async function save() {
    if (!rating || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setError("");
    const controller = new AbortController();
    request.current = controller;
    try {
      const { feedback } = await readingFeedbackApi.save(
        threadId,
        ownerId,
        { rating, reason },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (!feedback) throw new Error("Feedback was not saved");
      setSaved(feedback);
      focusAfterSave.current = true;
      setEditing(false);
    } catch {
      if (!controller.signal.aborted) {
        setError("아직 저장하지 못했어요. 선택한 반응으로 다시 시도해 주세요.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setSaving(false);
        saveLock.current = false;
      }
    }
  }

  const loadFailed = Boolean(error && !rating && !saved);
  const currentOptions = rating ? feedbackReasonOptions[rating] : [];
  const savedReason = saved
    ? feedbackReasonOptions[saved.rating].find(
        option => option.value === saved.reason,
      )?.label
    : null;

  return (
    <section className={styles.feedback} aria-labelledby={titleId}>
      <div className={styles.heading}>
        <h3 id={titleId}>오늘 그림책은 어땠나요?</h3>
        <p>아이와 나눈 반응을 알려 주세요. 더 좋은 그림책에 참고할게요.</p>
      </div>
      {loading && <p role="status">남긴 반응을 확인하고 있어요.</p>}
      {!loading && !editing && saved && (
        <div className={styles.saved}>
          <p role="status">
            <strong>
              {saved.rating === "again" ? "또 읽고 싶어요" : "조금 아쉬워요"}
            </strong>
            {savedReason && <span>{savedReason}</span>}
            <span>반응을 저장했어요. 고마워요!</span>
          </p>
          <button
            ref={editButton}
            type="button"
            className={styles.editButton}
            onClick={() => setEditing(true)}
          >
            반응 바꾸기
          </button>
        </div>
      )}
      {!loading && editing && !loadFailed && (
        <form
          onSubmit={event => {
            event.preventDefault();
            save();
          }}
        >
          <fieldset className={styles.choices} disabled={saving}>
            <legend className="sr-only">그림책을 읽은 반응</legend>
            <button
              type="button"
              aria-pressed={rating === "again"}
              onClick={() => chooseRating("again")}
            >
              또 읽고 싶어요
            </button>
            <button
              type="button"
              aria-pressed={rating === "disappointed"}
              onClick={() => chooseRating("disappointed")}
            >
              조금 아쉬워요
            </button>
          </fieldset>
          {rating && (
            <>
              <fieldset className={styles.reasons} disabled={saving}>
                <legend>
                  어떤 점이 그랬나요? <span>선택 사항 · 한 가지</span>
                </legend>
                <div>
                  {currentOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={reason === option.value}
                      onClick={() =>
                        setReason(reason === option.value ? null : option.value)
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className={styles.actions}>
                <button
                  type="submit"
                  className="button-primary"
                  disabled={saving}
                >
                  {saving ? "반응 저장 중…" : "반응 남기기"}
                </button>
                {saved && (
                  <button
                    type="button"
                    className={styles.editButton}
                    disabled={saving}
                    onClick={() => {
                      setRating(saved.rating);
                      setReason(saved.reason);
                      setError("");
                      setEditing(false);
                    }}
                  >
                    취소
                  </button>
                )}
              </div>
            </>
          )}
        </form>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {loadFailed && (
        <button
          type="button"
          className={styles.editButton}
          onClick={() => setRetry(value => value + 1)}
        >
          다시 확인
        </button>
      )}
    </section>
  );
}

export default function ReadingFeedback({
  threadId,
  ownerId,
}: ReadingFeedbackProps) {
  if (!ownerId || !Number.isSafeInteger(threadId) || threadId <= 0) {
    return null;
  }
  // Remount synchronously on account/book changes, including when an older
  // load/save response is still pending. No private feedback is stored locally.
  return (
    <FeedbackForm
      key={`${ownerId}:${threadId}`}
      ownerId={ownerId}
      threadId={threadId}
    />
  );
}

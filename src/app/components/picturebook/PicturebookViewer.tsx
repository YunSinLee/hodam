import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import type {
  PicturebookChoiceOption,
  PicturebookDraft,
} from "@/app/types/openai";
import { spreadStart } from "@/app/utils/picturebook";

import PicturebookPage from "./PicturebookPage";

const largeTextStorageKey = "hodam-reader-large-text";

function hasFinalConsonant(value: string) {
  const trimmedValue = value.trim();
  const lastChar = trimmedValue.charCodeAt(trimmedValue.length - 1);

  if (lastChar < 0xac00 || lastChar > 0xd7a3) {
    return false;
  }

  return (lastChar - 0xac00) % 28 !== 0;
}

function nameWithObjectParticle(name: string) {
  const trimmedName = name.trim();

  if (!trimmedName) return "아이를";

  return `${trimmedName}${hasFinalConsonant(trimmedName) ? "이를" : "를"}`;
}

interface PicturebookViewerProps {
  picturebook: PicturebookDraft;
  imageUrl?: string | null;
  imageUrls?: Record<number, string | null | undefined>;
  isImageLoading?: boolean;
  isEndingLoading?: boolean;
  selectedChoiceId?: string;
  onSelectChoice?: (choiceId: PicturebookChoiceOption["id"]) => void;
  onCreateAnother?: () => void;
  bookPath?: string;
  createAnotherLabel?: string;
  onImageError?: (pageNumber: number) => void;
}

export default function PicturebookViewer({
  picturebook,
  imageUrl,
  imageUrls = {},
  isImageLoading = false,
  isEndingLoading = false,
  selectedChoiceId = "",
  onSelectChoice,
  onCreateAnother,
  bookPath,
  createAnotherLabel = "다른 그림책 만들기",
  onImageError,
}: PicturebookViewerProps) {
  const readerId = useId();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [largeText, setLargeText] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [pendingChoiceId, setPendingChoiceId] = useState("");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const choiceRef = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef<"title" | "choice" | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const { pages } = picturebook;
  const bookIdentity =
    bookPath ||
    `${picturebook.createdAt}:${picturebook.title}:${picturebook.childName}`;
  const previousBook = useRef({
    identity: bookIdentity,
    status: picturebook.status,
  });
  const currentPage = pages[currentIndex];
  const isComplete = picturebook.status === "complete";
  const isLastPage = isDesktop
    ? currentIndex >= pages.length - 2
    : currentIndex >= pages.length - 1;

  const visiblePages = useMemo(() => {
    const firstPage = pages[currentIndex];
    const secondPage = pages[currentIndex + 1];
    return (isDesktop ? [firstPage, secondPage] : [firstPage]).filter(Boolean);
  }, [currentIndex, isDesktop, pages]);

  const isChoicePage =
    !isComplete &&
    visiblePages.some(page => page.pageNumber === picturebook.choice.afterPage);
  const choicePageIndex = pages.findIndex(
    page => page.pageNumber === picturebook.choice.afterPage,
  );

  function getPageImageUrl(pageNumber: number) {
    return imageUrls[pageNumber] || (pageNumber === 1 ? imageUrl : null);
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 640px)");
    const updateLayoutMode = () => {
      setIsDesktop(mediaQuery.matches);
      setCurrentIndex(index =>
        spreadStart(index, mediaQuery.matches, pages.length),
      );
    };

    updateLayoutMode();
    mediaQuery.addEventListener("change", updateLayoutMode);

    return () => mediaQuery.removeEventListener("change", updateLayoutMode);
  }, [pages.length]);

  useEffect(() => {
    setCanSpeak(
      typeof window.speechSynthesis?.speak === "function" &&
        typeof window.speechSynthesis?.cancel === "function" &&
        typeof window.SpeechSynthesisUtterance === "function",
    );
    try {
      setLargeText(localStorage.getItem(largeTextStorageKey) === "true");
    } catch {
      /* Reading stays available when browser storage is disabled. */
    }
    return () => {
      utteranceRef.current = null;
      window.speechSynthesis?.cancel?.();
    };
  }, []);

  useEffect(() => {
    utteranceRef.current = null;
    window.speechSynthesis?.cancel?.();
    setIsSpeaking(false);
  }, [bookIdentity, currentIndex, isDesktop]);

  useEffect(() => {
    const previous = previousBook.current;
    previousBook.current = {
      identity: bookIdentity,
      status: picturebook.status,
    };
    if (
      previous.identity !== bookIdentity ||
      (previous.status === "complete" && picturebook.status === "choice-ready")
    ) {
      setCurrentIndex(0);
      setFeedback("");
      setPendingChoiceId("");
      pendingFocus.current = "title";
    } else if (
      previous.status === "choice-ready" &&
      picturebook.status === "complete"
    ) {
      setCurrentIndex(picturebook.choice.afterPage);
      pendingFocus.current = "title";
    }
  }, [bookIdentity, picturebook.choice.afterPage, picturebook.status]);

  useEffect(() => {
    const target =
      pendingFocus.current === "choice"
        ? choiceRef.current
        : pendingFocus.current === "title"
          ? titleRef.current
          : null;
    if (target) {
      target.focus();
      pendingFocus.current = null;
    }
  }, [bookIdentity, currentIndex, picturebook.status]);

  function toggleLargeText() {
    const next = !largeText;
    setLargeText(next);
    try {
      localStorage.setItem(largeTextStorageKey, String(next));
    } catch {
      /* The preference still works for this reading session. */
    }
  }

  function goPrevious() {
    setCurrentIndex(index => Math.max(0, index - (isDesktop ? 2 : 1)));
  }

  function goNext() {
    setCurrentIndex(index =>
      spreadStart(index + (isDesktop ? 2 : 1), isDesktop, pages.length),
    );
  }

  function goToChoice() {
    if (choicePageIndex < 0) return;
    pendingFocus.current = "choice";
    setCurrentIndex(
      isDesktop
        ? Math.max(0, choicePageIndex - (choicePageIndex % 2))
        : choicePageIndex,
    );
  }

  function navigateWithKeyboard(event: KeyboardEvent<HTMLElement>) {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      (event.target as HTMLElement).closest(
        "button, a, input, textarea, select, [contenteditable=true]",
      )
    )
      return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goPrevious();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goNext();
    } else if (event.key === "Home") {
      event.preventDefault();
      setCurrentIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setCurrentIndex(spreadStart(pages.length - 1, isDesktop, pages.length));
    }
  }

  async function copyBookLink() {
    if (!bookPath) return;
    try {
      await navigator.clipboard.writeText(
        new URL(bookPath, window.location.origin).toString(),
      );
      setFeedback(
        "내 책 링크를 복사했어요. 같은 계정으로 로그인하면 열 수 있어요.",
      );
    } catch {
      setFeedback("링크를 복사하지 못했어요. 내 책장에서 다시 열어주세요.");
    }
  }

  function downloadStory() {
    const text = [
      picturebook.title,
      "",
      ...pages.map(page => `${page.pageNumber}쪽\n${page.textKo}`),
    ].join("\n\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${picturebook.title.replace(/[\\/:*?"<>|]/g, "_")}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFeedback("이야기를 텍스트 파일로 저장했어요.");
  }

  function readAloud() {
    if (!canSpeak) return;
    utteranceRef.current = null;
    window.speechSynthesis.cancel();
    if (isSpeaking) {
      setIsSpeaking(false);
      return;
    }
    try {
      const utterance = new SpeechSynthesisUtterance(
        visiblePages.map(page => page.textKo).join(" "),
      );
      utterance.lang = "ko-KR";
      utterance.rate = 0.85;
      utteranceRef.current = utterance;
      utterance.onend = () => {
        if (utteranceRef.current !== utterance) return;
        utteranceRef.current = null;
        setIsSpeaking(false);
      };
      utterance.onerror = event => {
        if (utteranceRef.current !== utterance) return;
        utteranceRef.current = null;
        setIsSpeaking(false);
        if (event.error !== "canceled" && event.error !== "interrupted")
          setFeedback("이 기기에서 소리를 재생하지 못했어요.");
      };
      setFeedback("");
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    } catch {
      utteranceRef.current = null;
      setIsSpeaking(false);
      setFeedback("이 기기에서 소리를 재생하지 못했어요.");
    }
  }

  if (!currentPage) {
    return (
      <div className="rounded-xl border border-orange-100 bg-white p-6 text-center text-gray-600">
        그림책 페이지를 불러올 수 없습니다.
      </div>
    );
  }

  // The named reading region supports optional page keys as well as native buttons.
  /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  return (
    <section
      className="rounded-xl border border-[#dfdfd2] bg-[#fffefb] p-4 sm:p-6"
      aria-label="그림책 읽기"
      aria-describedby={`${readerId}-keyboard-help`}
      tabIndex={0}
      onKeyDown={navigateWithKeyboard}
    >
      {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
      <p id={`${readerId}-keyboard-help`} className="sr-only">
        좌우 방향키로 쪽을 넘길 수 있어요. Home 키는 첫 쪽, End 키는 마지막
        쪽으로 이동해요.
      </p>
      <div className="reading-toolbar">
        {canSpeak && (
          <button type="button" onClick={readAloud} aria-pressed={isSpeaking}>
            {isSpeaking ? "읽어주기 멈추기" : "이 쪽 읽어주기"}
          </button>
        )}
        <button
          type="button"
          onClick={toggleLargeText}
          aria-pressed={largeText}
        >
          {largeText ? "기본 글씨" : "큰 글씨"}
        </button>
      </div>
      {feedback && (
        <p className="notice-info mb-4" role="status">
          {feedback}
        </p>
      )}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-orange-600">
            {nameWithObjectParticle(picturebook.childName)} 위한 잠자리 그림책
          </p>
          <h2
            ref={titleRef}
            tabIndex={-1}
            className="text-2xl font-bold text-gray-900"
          >
            {picturebook.title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-gray-600">
            {picturebook.situation}
          </p>
        </div>
        <div
          className="rounded-full bg-orange-50 px-3 py-1 text-sm font-medium text-orange-700"
          role="status"
          aria-atomic="true"
        >
          {currentPage.pageNumber}
          {isDesktop && visiblePages.length === 2
            ? `–${visiblePages[1].pageNumber}`
            : ""}{" "}
          / {isComplete ? pages.length : "8"}쪽
        </div>
      </div>

      {!isComplete && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="font-semibold">첫 4쪽을 읽은 뒤 선택해요.</span>
            <span className="ml-1 text-orange-700">
              선택하면 5-8쪽 결말이 이어집니다.
            </span>
          </div>
          {!isChoicePage && (
            <button
              type="button"
              onClick={goToChoice}
              className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
              선택지로 가기
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {visiblePages.map(page => (
          <PicturebookPage
            largeText={largeText}
            key={page.pageNumber}
            page={page}
            imageUrl={getPageImageUrl(page.pageNumber)}
            isImageLoading={isImageLoading}
            onImageError={onImageError}
            showChoiceCue={
              !isComplete && page.pageNumber === picturebook.choice.afterPage
            }
          />
        ))}
      </div>

      {isChoicePage && onSelectChoice && (
        <div
          className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-4"
          aria-busy={isEndingLoading}
        >
          <p className="mb-2 text-sm font-semibold text-orange-700">
            4쪽을 읽고 하나를 골라주세요. 선택하면 5-8쪽 결말이 완성됩니다.
          </p>
          <h3
            ref={choiceRef}
            tabIndex={-1}
            className="mb-3 text-lg font-semibold text-gray-900"
          >
            {picturebook.choice.promptKo}
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {picturebook.choice.options.map(option => {
              const isSelected =
                (selectedChoiceId || pendingChoiceId) === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={isEndingLoading}
                  aria-pressed={isSelected}
                  onClick={() => {
                    setPendingChoiceId(option.id);
                    onSelectChoice?.(option.id);
                  }}
                  className={`rounded-lg border p-4 text-left transition ${
                    isSelected
                      ? "border-orange-500 bg-white text-orange-800"
                      : "border-orange-100 bg-white text-gray-800 hover:border-orange-400"
                  } ${isEndingLoading ? "cursor-not-allowed opacity-70" : ""}`}
                >
                  <span className="mb-1 block text-sm font-bold text-orange-600">
                    {option.id}
                  </span>
                  <span className="block font-medium">{option.labelKo}</span>
                </button>
              );
            })}
          </div>
          {isEndingLoading && (
            <p className="mt-3 text-sm text-orange-700" role="status">
              선택한 이야기로 결말을 만들고 있어요. 더 이상 선택지는 나오지
              않아요.
            </p>
          )}
        </div>
      )}

      {isComplete && isLastPage && (
        <div className="mt-5 rounded-xl border border-green-100 bg-green-50 p-4">
          <h3 className="font-semibold text-green-900">그림책이 완성됐어요</h3>
          <p className="mt-1 text-sm text-green-800">
            {bookPath
              ? "이야기를 파일로 간직하고, 내 책장에서 다시 읽을 수 있어요."
              : "예시 이야기를 파일로 저장하거나 처음부터 다시 읽어보세요."}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={downloadStory}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              이야기 파일 저장
            </button>
            {bookPath && (
              <button
                type="button"
                onClick={copyBookLink}
                className="button-secondary"
              >
                내 책 링크 복사
              </button>
            )}
            {onCreateAnother && (
              <button
                type="button"
                onClick={onCreateAnother}
                className="rounded-lg border border-green-200 bg-white px-4 py-2 text-sm font-semibold text-green-800 hover:border-green-400"
              >
                {createAnotherLabel}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="reader-controls mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goPrevious}
          disabled={currentIndex === 0}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          이전
        </button>
        <div className="text-sm text-gray-600 text-center" aria-live="polite">
          {picturebook.status === "choice-ready" && isChoicePage
            ? "위 선택지 중 하나를 골라주세요"
            : picturebook.status === "choice-ready"
              ? "4쪽까지 넘기면 선택지가 나옵니다"
              : "완결된 그림책"}
        </div>
        <button
          type="button"
          onClick={goNext}
          disabled={isLastPage}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          다음
        </button>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  createPicturebookAction,
  finishPicturebookAction,
} from "@/app/api/story-actions";
import PicturebookInputForm from "@/app/components/picturebook/PicturebookInputForm";
import PicturebookViewer from "@/app/components/picturebook/PicturebookViewer";
import type {
  PicturebookChoiceOption,
  PicturebookDraft,
  PicturebookInput,
  Thread,
} from "@/app/types/openai";
import {
  initialInput,
  situationExamples,
  validatePicturebookInput,
} from "@/app/utils/picturebook";
import { requireAccessToken } from "@/app/utils/session";
import useBead from "@/services/hooks/use-bead";
import usePicturebookImages from "@/services/hooks/use-picturebook-images";
import useUserInfo from "@/services/hooks/use-user-info";

const storageKey = "hodam-picturebook-input";
export default function Service() {
  const [input, setInput] = useState<PicturebookInput>(initialInput);
  const [thread, setThread] = useState<Thread | null>(null);
  const [book, setBook] = useState<PicturebookDraft | null>(null);
  const [stage, setStage] = useState<"idle" | "drafting" | "ending">("idle");
  const [step, setStep] = useState("");
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [selectedChoice, setSelectedChoice] =
    useState<PicturebookChoiceOption["id"]>();
  const busy = useRef(false);
  const epoch = useRef(0);
  const requestId = useRef<string | null>(null);
  const requestInput = useRef<PicturebookInput | null>(null);
  const { userInfo, isAuthReady } = useUserInfo();
  const { bead, setBead } = useBead();
  const images = usePicturebookImages();
  const { reset: resetImages } = images;
  const router = useRouter();

  useEffect(() => {
    epoch.current += 1;
    busy.current = false;
    requestId.current = null;
    requestInput.current = null;
    setThread(null);
    setBook(null);
    setStage("idle");
    setError("");
    setSelectedChoice(undefined);
    resetImages();
    return () => {
      epoch.current += 1;
      resetImages();
    };
  }, [userInfo.id, resetImages]);

  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      if (
        stored &&
        Date.now() - stored.savedAt < 2 * 60 * 60 * 1000 &&
        !validatePicturebookInput(stored.input)
      )
        setInput(stored.input);
      else sessionStorage.removeItem(storageKey);
    } catch {
      /* Storage may be unavailable in private browsing. */
    }
    const example = new URLSearchParams(window.location.search).get("example");
    if (example && example in situationExamples)
      setInput(value => ({
        ...value,
        ...situationExamples[example as keyof typeof situationExamples],
      }));
  }, []);

  useEffect(() => {
    if (stage === "idle") {
      setSeconds(0);
      return undefined;
    }
    const timer = window.setInterval(
      () => setSeconds(value => value + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [stage]);

  useEffect(() => {
    if (!busy.current && !images.isLoading) return undefined;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [stage, images.isLoading]);

  async function createBook() {
    if (busy.current || !isAuthReady) return;
    const invalid = validatePicturebookInput(input);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!userInfo.id) {
      try {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({ input, savedAt: Date.now() }),
        );
      } catch {
        /* Form remains usable without storage. */
      }
      router.push("/sign-in?next=/service");
      return;
    }
    busy.current = true;
    const currentEpoch = epoch.current;
    const isCurrent = () =>
      currentEpoch === epoch.current &&
      useUserInfo.getState().userInfo.id === userInfo.id;
    setStage("drafting");
    setError("");
    try {
      const token = await requireAccessToken();
      if (!isCurrent()) return;
      setStep("아이의 하루로 첫 4쪽을 쓰고 책장에 보관하고 있어요.");
      requestId.current ||= crypto.randomUUID();
      requestInput.current ||= input;
      const result = await createPicturebookAction(
        requestInput.current,
        token,
        requestId.current,
      );
      if (!isCurrent()) return;
      if (!result.ok) {
        if (!result.retrySameRequest) {
          requestId.current = null;
          requestInput.current = null;
        }
        setError(result.message);
        return;
      }
      requestId.current = null;
      requestInput.current = null;
      setBead({
        ...useBead.getState().bead,
        user_id: userInfo.id,
        count: result.beadCount,
      });
      setThread({ id: result.threadId, user_id: userInfo.id } as Thread);
      setBook(result.book);
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* Ignore unavailable storage. */
      }
      images.reset();
      images.draw(result.threadId, result.book.pages);
    } catch {
      if (!isCurrent()) return;
      if (requestInput.current) setInput(requestInput.current);
      setError(
        "요청 결과를 확인하지 못했어요. 내 책장을 먼저 확인해주세요. 다시 시도하면 같은 요청의 저장 결과를 확인해요.",
      );
    } finally {
      if (isCurrent()) {
        busy.current = false;
        setStage("idle");
      }
    }
  }

  async function finishBook(choiceId: PicturebookChoiceOption["id"]) {
    if (
      busy.current ||
      !book ||
      !thread ||
      !userInfo.id ||
      book.status === "complete"
    )
      return;
    busy.current = true;
    const currentEpoch = epoch.current;
    const isCurrent = () =>
      currentEpoch === epoch.current &&
      useUserInfo.getState().userInfo.id === userInfo.id;
    setStage("ending");
    setSelectedChoice(choiceId);
    setError("");
    setStep("선택한 행동으로 결말 4쪽을 쓰고 있어요.");
    try {
      const token = await requireAccessToken();
      if (!isCurrent()) return;
      const result = await finishPicturebookAction(thread.id, choiceId, token);
      if (!isCurrent()) return;
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setBook(result.book);
      images.draw(thread.id, result.book.pages.slice(4));
    } catch {
      if (!isCurrent()) return;
      setError(
        "결말 저장 결과를 확인하지 못했어요. 내 책장에서 확인하거나 잠시 후 다시 시도해주세요. 추가 곶감은 사용하지 않아요.",
      );
    } finally {
      if (isCurrent()) {
        busy.current = false;
        setStage("idle");
      }
    }
  }
  function reset() {
    epoch.current += 1;
    busy.current = false;
    requestId.current = null;
    requestInput.current = null;
    setStage("idle");
    images.reset();
    setBook(null);
    setThread(null);
    setError("");
    setInput(initialInput);
    setSelectedChoice(undefined);
  }
  return (
    <div className="page-shell">
      {!book && stage === "idle" && (
        <PicturebookInputForm
          value={input}
          picturebookCost={1}
          beadCount={bead.count}
          isLoading={false}
          isAuthReady={isAuthReady}
          isSignedIn={!!userInfo.id}
          onChange={value => {
            requestId.current = null;
            requestInput.current = null;
            setInput(value);
          }}
          onSubmit={createBook}
        />
      )}
      {error && (
        <div className="notice-error my-5" role="alert">
          {error}
          <div className="flex gap-5 mt-2">
            <Link className="text-link" href="/bead">
              곶감 확인
            </Link>
            <Link className="text-link" href="/my-story">
              내 책장
            </Link>
          </div>
        </div>
      )}
      {stage !== "idle" && (
        <section className="notice-info my-5" role="status" aria-live="polite">
          <h1 className="text-xl mb-2">
            {stage === "ending"
              ? "이야기의 끝을 쓰고 있어요"
              : `${input.childName}의 그림책을 만들고 있어요`}
          </h1>
          <p>{step}</p>
          <p className="mt-3 text-sm">
            {seconds}초째 작업 중 · 잠시 이 화면에서 기다려주세요.
          </p>
        </section>
      )}
      {book && thread?.user_id === userInfo.id && (
        <>
          <div className="reading-toolbar">
            <Link href={`/my-story/${thread?.id}`} className="text-link">
              내 책장에서 열기 →
            </Link>
            <span className="text-sm text-gray-600">
              {book.status === "complete"
                ? "8쪽 모두 저장됐어요"
                : "첫 4쪽이 저장됐어요"}
            </span>
          </div>
          {images.isLoading && (
            <p className="notice-info mb-5" role="status">
              그림을 준비하고 있어요. {images.progress.completed}/
              {images.progress.total}쪽 처리 · 먼저 이야기를 읽어도 좋아요.
            </p>
          )}
          {!images.isLoading &&
            book.pages.some(page => !images.urls[page.pageNumber]) && (
              <div className="notice-error mb-5" role="status">
                {images.error || "일부 그림을 열지 못했어요."} 글은 안전하게
                저장됐어요.
                <button
                  type="button"
                  className="button-secondary block mt-3"
                  onClick={() => {
                    if (thread)
                      images.draw(
                        thread.id,
                        book.pages.filter(
                          page => !images.urls[page.pageNumber],
                        ),
                      );
                  }}
                >
                  빠진 그림 다시 요청하기
                </button>
              </div>
            )}
          <PicturebookViewer
            picturebook={book}
            imageUrls={images.urls}
            onImageError={images.invalidate}
            isImageLoading={images.isLoading}
            isEndingLoading={stage === "ending"}
            selectedChoiceId={book.selectedChoiceId || selectedChoice}
            onSelectChoice={finishBook}
            onCreateAnother={reset}
            bookPath={thread ? `/my-story/${thread.id}` : undefined}
          />
        </>
      )}
    </div>
  );
}

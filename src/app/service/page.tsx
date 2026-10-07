/* eslint-disable react/jsx-no-bind */
// Render branches are mutually exclusive; handlers are direct, unmemoized UI actions.

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
import {
  associateSearchGeneration,
  beginSearchGeneration,
  completeSearchGeneration,
  trackFirstBookStep,
  type SearchGenerationAttempt,
} from "@/lib/client/search-analytics";
import {
  consumeAdventureStarter,
  defaultAdventure,
  nextAdventureInput,
} from "@/lib/picturebook/adventure";
import { consumeSampleStarter } from "@/lib/picturebook/sample";
import useBead from "@/services/hooks/use-bead";
import usePicturebookImages from "@/services/hooks/use-picturebook-images";
import useUserInfo from "@/services/hooks/use-user-info";

import {
  clearPendingPicturebookRequest,
  readPendingPicturebookRequest,
  readUnconfirmedPicturebookRequests,
  savePendingPicturebookRequest,
  setAsidePicturebookRequest,
  type PendingPicturebookRequest,
} from "./picturebook-request-recovery";

const storageKey = "hodam-picturebook-input";
export default function Service() {
  const [input, setInput] = useState<PicturebookInput>(initialInput);
  const [fromSample, setFromSample] = useState(false);
  const [formRevision, setFormRevision] = useState(0);
  const [thread, setThread] = useState<Thread | null>(null);
  const [book, setBook] = useState<PicturebookDraft | null>(null);
  const [stage, setStage] = useState<"idle" | "drafting" | "ending">("idle");
  const [step, setStep] = useState("");
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [pendingRequest, setPendingRequest] =
    useState<PendingPicturebookRequest | null>(null);
  const [unconfirmedRequests, setUnconfirmedRequests] = useState<
    PendingPicturebookRequest[]
  >([]);
  const [confirmSeparateBook, setConfirmSeparateBook] = useState(false);
  const [selectedChoice, setSelectedChoice] =
    useState<PicturebookChoiceOption["id"]>();
  const busy = useRef(false);
  const formStarted = useRef(false);
  const initialFormApplied = useRef(false);
  const adventureOwner = useRef<string | undefined>();
  const epoch = useRef(0);
  const requestId = useRef<string | null>(null);
  const requestInput = useRef<PicturebookInput | null>(null);
  const requestUncertain = useRef(false);
  const searchAttempt = useRef<SearchGenerationAttempt | null>(null);
  const { userInfo, isAuthReady } = useUserInfo();
  const previousOwner = useRef(userInfo.id);
  const { bead, setBead } = useBead();
  const images = usePicturebookImages();
  const { reset: resetImages } = images;
  const router = useRouter();

  useEffect(() => {
    const ownerChanged =
      !!previousOwner.current && previousOwner.current !== userInfo.id;
    previousOwner.current = userInfo.id;
    if (ownerChanged) {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* Storage may be unavailable. */
      }
    }
    if (
      ownerChanged ||
      requestInput.current ||
      (adventureOwner.current && adventureOwner.current !== userInfo.id)
    ) {
      setInput(initialInput);
      setFromSample(false);
      adventureOwner.current = undefined;
    }
    epoch.current += 1;
    busy.current = false;
    requestId.current = null;
    requestInput.current = null;
    requestUncertain.current = false;
    setPendingRequest(null);
    setUnconfirmedRequests([]);
    setConfirmSeparateBook(false);
    searchAttempt.current = null;
    setThread(null);
    setBook(null);
    setStage("idle");
    setError("");
    setSelectedChoice(undefined);
    resetImages();
    if (userInfo.id) {
      setUnconfirmedRequests(readUnconfirmedPicturebookRequests(userInfo.id));
      const pending = readPendingPicturebookRequest(userInfo.id);
      if (pending) {
        setFromSample(false);
        requestId.current = pending.requestId;
        requestInput.current = pending.input;
        requestUncertain.current = true;
        setPendingRequest(pending);
        setInput(pending.input);
      }
    }
    return () => {
      epoch.current += 1;
      resetImages();
    };
  }, [userInfo.id, resetImages]);

  useEffect(() => {
    if (!isAuthReady) return;
    if (initialFormApplied.current) return;
    initialFormApplied.current = true;
    const sampleStarter = consumeSampleStarter();
    const adventureStarter = consumeAdventureStarter(userInfo.id);
    if (requestInput.current) return;
    if (adventureStarter) {
      adventureOwner.current = userInfo.id;
      setInput(adventureStarter);
      return;
    }
    if (sampleStarter) {
      setInput({ ...initialInput, ...sampleStarter });
      setFromSample(true);
      return;
    }
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
    if (new URLSearchParams(window.location.search).get("mode") === "adventure")
      setInput(value => ({
        ...value,
        situation: "",
        lesson: "",
        adventure: { ...defaultAdventure },
      }));
    if (example && example in situationExamples)
      setInput(value => ({
        ...value,
        ...situationExamples[example as keyof typeof situationExamples],
      }));
  }, [isAuthReady, userInfo.id]);

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
      const unloadEvent = event;
      unloadEvent.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [stage, images.isLoading]);

  useEffect(() => {
    if (!book || !thread || thread.user_id !== userInfo.id) return;
    completeSearchGeneration(thread.id, {
      status: book.status,
      pageCount: book.pages.length,
      hasAllImages: book.pages.every(page => !!images.urls[page.pageNumber]),
    });
  }, [book, thread, images.urls, userInfo.id]);

  async function createBook() {
    if (busy.current || !isAuthReady) return;
    const invalid = validatePicturebookInput(input);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!userInfo.id) {
      trackFirstBookStep("login_requested");
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
      setStep(
        input.adventure
          ? "아이와 단짝의 첫 모험 4쪽을 쓰고 책장에 보관하고 있어요."
          : "아이의 하루로 첫 4쪽을 쓰고 책장에 보관하고 있어요.",
      );
      requestId.current ||= crypto.randomUUID();
      requestInput.current ||= input;
      const pending = {
        userId: userInfo.id,
        requestId: requestId.current,
        input: requestInput.current,
      };
      savePendingPicturebookRequest(pending, unconfirmedRequests);
      setPendingRequest(pending);
      searchAttempt.current = beginSearchGeneration(searchAttempt.current);
      const result = await createPicturebookAction(
        requestInput.current,
        token,
        requestId.current,
      );
      if (!isCurrent()) return;
      if (!result.ok) {
        if (!result.retrySameRequest && !requestUncertain.current) {
          clearPendingPicturebookRequest(
            userInfo.id,
            requestId.current,
            unconfirmedRequests,
          );
          requestId.current = null;
          requestInput.current = null;
          setPendingRequest(null);
          searchAttempt.current = null;
        } else {
          // A failed retry cannot prove that another worker did not finish the
          // earlier attempt whose result was lost.
          requestUncertain.current = true;
        }
        setError(result.message);
        return;
      }
      clearPendingPicturebookRequest(
        userInfo.id,
        requestId.current,
        unconfirmedRequests,
      );
      requestId.current = null;
      requestInput.current = null;
      requestUncertain.current = false;
      setPendingRequest(null);
      associateSearchGeneration(searchAttempt.current, result.threadId);
      searchAttempt.current = null;
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
      if (requestInput.current) {
        requestUncertain.current = true;
        setInput(requestInput.current);
      }
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
    setFormRevision(value => value + 1);
    epoch.current += 1;
    busy.current = false;
    requestId.current = null;
    requestInput.current = null;
    requestUncertain.current = false;
    setPendingRequest(null);
    setConfirmSeparateBook(false);
    searchAttempt.current = null;
    setStage("idle");
    images.reset();
    setBook(null);
    setThread(null);
    setError("");
    setInput(initialInput);
    adventureOwner.current = undefined;
    setFromSample(false);
    setSelectedChoice(undefined);
  }
  function continueAdventure() {
    if (
      !book ||
      thread?.user_id !== userInfo.id ||
      userInfo.id !== useUserInfo.getState().userInfo.id ||
      busy.current ||
      images.isLoading
    )
      return;
    const next = nextAdventureInput(book);
    if (!next) return;
    reset();
    adventureOwner.current = userInfo.id;
    setInput(next);
    window.requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(".creation-form h1")?.focus(),
    );
  }
  function startSeparateBook() {
    if (
      !confirmSeparateBook ||
      !pendingRequest ||
      pendingRequest.userId !== userInfo.id ||
      pendingRequest.userId !== useUserInfo.getState().userInfo.id ||
      busy.current
    )
      return;
    const previousRequests = setAsidePicturebookRequest(
      pendingRequest,
      unconfirmedRequests,
    );
    reset();
    setUnconfirmedRequests(previousRequests);
  }
  function resumeUnconfirmedRequest(request: PendingPicturebookRequest) {
    if (
      request.userId !== userInfo.id ||
      request.userId !== useUserInfo.getState().userInfo.id ||
      busy.current ||
      images.isLoading ||
      pendingRequest
    )
      return;
    const remaining = unconfirmedRequests.filter(
      value => value.requestId !== request.requestId,
    );
    reset();
    requestId.current = request.requestId;
    requestInput.current = request.input;
    requestUncertain.current = true;
    setInput(request.input);
    setPendingRequest(request);
    setUnconfirmedRequests(remaining);
    savePendingPicturebookRequest(request, remaining);
  }
  const ownedUnconfirmedRequests = unconfirmedRequests.filter(
    request => request.userId === userInfo.id,
  );
  return (
    <div className="page-shell">
      {ownedUnconfirmedRequests.length > 0 && (
        <details className="notice-info mb-5">
          <summary>미확인 요청 {ownedUnconfirmedRequests.length}건</summary>
          <p className="mt-3">
            아래 요청은 나중에 책장에 저장될 수 있어요. 같은 요청을 이어서
            확인할 수 있도록 보관했어요.
          </p>
          <Link className="text-link inline-block mt-3" href="/my-story">
            내 책장에서 저장된 책 확인하기
          </Link>
          <ul className="mt-4 space-y-4">
            {ownedUnconfirmedRequests.map(request => (
              <li key={request.requestId}>
                <p className="font-medium">
                  {request.input.childName}의 그림책
                </p>
                <p className="text-sm break-words">{request.input.situation}</p>
                <button
                  type="button"
                  className="button-secondary mt-2"
                  disabled={
                    stage !== "idle" || images.isLoading || !!pendingRequest
                  }
                  onClick={() => resumeUnconfirmedRequest(request)}
                >
                  이 요청 이어서 확인하기
                </button>
              </li>
            ))}
          </ul>
        </details>
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
      {!book && stage === "idle" && (
        <>
          {pendingRequest && pendingRequest.userId === userInfo.id && (
            <section
              className="notice-info mb-5"
              aria-labelledby="request-recovery-title"
            >
              <h2 id="request-recovery-title" className="text-xl mb-2">
                이전 그림책 요청을 이어서 확인해요
              </h2>
              <p>
                결과를 확인하지 못한 요청이 있어요. 아래에 보관한 내용으로
                이어서 확인하면, 이미 저장된 책은 다시 만들거나 곶감을 추가로
                쓰지 않아요.
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-4">
                <button
                  type="button"
                  className="button-primary"
                  disabled={!isAuthReady}
                  onClick={createBook}
                >
                  이전 요청 이어서 확인하기
                </button>
                <Link className="text-link" href="/my-story">
                  내 책장 먼저 보기
                </Link>
              </div>
              {!confirmSeparateBook ? (
                <button
                  type="button"
                  className="text-link mt-4"
                  onClick={() => setConfirmSeparateBook(true)}
                >
                  새 그림책 따로 만들기
                </button>
              ) : (
                <div className="mt-5" role="alert">
                  <p>
                    이전 요청은 나중에 내 책장에 저장될 수 있어요. 새 그림책을
                    만들면 곶감 1개를 별도로 사용해요. 이전 요청은 미확인
                    요청으로 보관하고 새 그림책을 작성할까요?
                  </p>
                  <div className="flex flex-wrap gap-3 mt-3">
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setConfirmSeparateBook(false)}
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      className="button-primary"
                      onClick={startSeparateBook}
                    >
                      확인하고 새 그림책 작성
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
          <fieldset disabled={!!pendingRequest} className="min-w-0">
            <PicturebookInputForm
              key={`${userInfo.id || "anonymous"}:${formRevision}`}
              value={input}
              picturebookCost={1}
              beadCount={bead.count}
              isLoading={false}
              isAuthReady={isAuthReady}
              isSignedIn={!!userInfo.id}
              fromSample={fromSample}
              onChange={value => {
                if (requestInput.current) return;
                if (value.situation !== input.situation || value.adventure)
                  setFromSample(false);
                if (!formStarted.current) {
                  formStarted.current = true;
                  trackFirstBookStep("form_started");
                }
                requestId.current = null;
                requestInput.current = null;
                searchAttempt.current = null;
                setInput(value);
              }}
              onSubmit={createBook}
            />
          </fieldset>
        </>
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
            onContinueAdventure={continueAdventure}
            bookPath={thread ? `/my-story/${thread.id}` : undefined}
          />
        </>
      )}
    </div>
  );
}

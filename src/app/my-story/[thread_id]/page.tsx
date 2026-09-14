/* eslint-disable @next/next/no-img-element, no-nested-ternary, react/jsx-no-bind */
// Render branches are mutually exclusive; handlers are direct, unmemoized UI actions.

"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import { useParams } from "next/navigation";

import imageApi from "@/app/api/image";
import messagesApi from "@/app/api/messages";
import { finishPicturebookAction } from "@/app/api/story-actions";
import threadApi from "@/app/api/thread";
import GuideForSign from "@/app/components/GuideForSign";
import MessageDisplay from "@/app/components/MessageDisplay";
import PicturebookViewer from "@/app/components/picturebook/PicturebookViewer";
import type {
  PicturebookChoiceOption,
  PicturebookDraft,
  Thread,
} from "@/app/types/openai";
import { parsePicturebookDraft } from "@/app/utils/picturebook";
import { requireAccessToken } from "@/app/utils/session";
import usePicturebookImages from "@/services/hooks/use-picturebook-images";
import useUserInfo from "@/services/hooks/use-user-info";

export default function MyStoryDetail() {
  const params = useParams();
  const id = Number(params?.thread_id);
  const { userInfo, isAuthReady } = useUserInfo();
  const [thread, setThread] = useState<Thread | null>(null);
  const [book, setBook] = useState<PicturebookDraft | null>(null);
  const [messages, setMessages] = useState<{ text: string; text_en: string }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [ending, setEnding] = useState(false);
  const [selectedChoice, setSelectedChoice] =
    useState<PicturebookChoiceOption["id"]>();
  const [showEnglish, setShowEnglish] = useState(false);
  const busy = useRef(false);
  const epoch = useRef(0);
  const images = usePicturebookImages();
  const { reset } = images;
  useEffect(() => {
    epoch.current += 1;
    busy.current = false;
    setEnding(false);
    setSelectedChoice(undefined);
    let active = true;
    setLoading(true);
    setThread(null);
    setBook(null);
    setError("");
    setLoadFailed(false);
    setMessages([]);
    setShowEnglish(false);
    reset();
    const isCurrent = () =>
      active && useUserInfo.getState().userInfo.id === userInfo.id;
    let loadErrorMessage =
      "그림책을 불러오지 못했어요. 내 계정의 책인지, 주소가 올바른지 확인해주세요.";
    async function load() {
      if (!userInfo.id) return;
      if (!Number.isSafeInteger(id) || id <= 0)
        throw new Error("Invalid story");
      const result = await threadApi.getThreadByID(id);
      if (result.user_id !== userInfo.id) throw new Error("Private story");
      const parsed = parsePicturebookDraft(result.raw_text);
      if (!isCurrent()) return;
      setThread(result);
      setBook(parsed);
      if (!parsed) {
        loadErrorMessage =
          "저장된 동화 글을 불러오지 못했어요. 다시 불러오기를 눌러주세요.";
        const data = await messagesApi.fetchMessages({ thread_ids: [id] });
        if (isCurrent())
          setMessages(
            (data[id] || []).map(message => ({
              text: message.message,
              text_en: message.message_en,
            })),
          );
      }
      if (!isCurrent()) return;
      if (result.has_image) {
        loadErrorMessage =
          "저장된 그림을 불러오지 못했어요. 다시 불러오기를 눌러주세요. 이야기는 안전하게 저장되어 있어요.";
        const urls = await imageApi.getPageImages({
          thread_id: id,
          page_numbers: parsed
            ? parsed.pages.map(page => page.pageNumber)
            : [1],
        });
        if (isCurrent()) reset(urls);
      }
    }
    load()
      .catch(() => {
        if (isCurrent()) {
          setLoadFailed(true);
          setError(loadErrorMessage);
        }
      })
      .finally(() => {
        if (isCurrent()) setLoading(false);
      });
    return () => {
      active = false;
      epoch.current += 1;
      reset();
    };
  }, [id, userInfo.id, retry, reset]);

  async function finish(choiceId: PicturebookChoiceOption["id"]) {
    if (
      !book ||
      !thread ||
      !userInfo.id ||
      busy.current ||
      book.status === "complete"
    )
      return;
    busy.current = true;
    const currentEpoch = epoch.current;
    const isCurrent = () =>
      currentEpoch === epoch.current &&
      useUserInfo.getState().userInfo.id === userInfo.id;
    setEnding(true);
    setSelectedChoice(choiceId);
    setError("");
    try {
      const token = await requireAccessToken();
      if (!isCurrent()) return;
      const result = await finishPicturebookAction(id, choiceId, token);
      if (!isCurrent()) return;
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setBook(result.book);
      images.draw(id, result.book.pages.slice(4));
    } catch {
      if (!isCurrent()) return;
      setError(
        "결말 저장 결과를 확인하지 못했어요. 내 책장에서 확인하거나 잠시 후 다시 시도해주세요. 추가 곶감은 사용하지 않아요.",
      );
    } finally {
      if (isCurrent()) {
        busy.current = false;
        setEnding(false);
      }
    }
  }
  useEffect(() => {
    if (!ending && !images.isLoading) return undefined;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      const unloadEvent = event;
      unloadEvent.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [ending, images.isLoading]);
  if (!isAuthReady)
    return (
      <p className="empty-state" role="status">
        로그인을 확인하고 있어요.
      </p>
    );
  if (!userInfo.id) return <GuideForSign />;
  const missing =
    book?.pages.filter(page => !images.urls[page.pageNumber]) || [];
  return (
    <div className="page-shell">
      <Link className="text-link inline-block mb-6" href="/my-story">
        ← 내 책장
      </Link>
      {loading ||
      (thread && (thread.id !== id || thread.user_id !== userInfo.id)) ? (
        <p className="empty-state" role="status">
          그림책을 꺼내고 있어요.
        </p>
      ) : (
        <>
          {error && (
            <div className="notice-error mb-5" role="alert">
              {error}
              {loadFailed && (
                <button
                  className="button-secondary block mt-4"
                  type="button"
                  onClick={() => setRetry(value => value + 1)}
                >
                  다시 불러오기
                </button>
              )}
            </div>
          )}
          {book ? (
            <>
              {images.isLoading ? (
                <p className="notice-info mb-4" role="status">
                  그림을 채우고 있어요. {images.progress.completed}/
                  {images.progress.total}쪽 처리 · 이 화면을 열어두세요.
                </p>
              ) : (
                missing.length > 0 && (
                  <div className="notice-info mb-4 flex flex-wrap justify-between items-center gap-3">
                    <p>
                      그림 {missing.length}장이 아직 없어요. 글은 바로 읽을 수
                      있어요.
                    </p>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => images.draw(id, missing)}
                    >
                      빠진 그림 채우기
                    </button>
                  </div>
                )
              )}
              {!images.isLoading && images.progress.failed > 0 && (
                <p className="notice-error mb-4" role="alert">
                  {images.error || "일부 그림을 열지 못했어요."}
                </p>
              )}
              <PicturebookViewer
                key={id}
                picturebook={book}
                imageUrls={images.urls}
                onImageError={images.invalidate}
                isImageLoading={images.isLoading}
                isEndingLoading={ending}
                selectedChoiceId={book.selectedChoiceId || selectedChoice}
                onSelectChoice={finish}
                bookPath={`/my-story/${id}`}
              />
            </>
          ) : thread && messages.length > 0 ? (
            <>
              <h1 className="text-2xl mb-5">저장된 동화</h1>
              {thread.able_english && (
                <label className="flex gap-2 mb-5">
                  <input
                    type="checkbox"
                    checked={showEnglish}
                    onChange={event => setShowEnglish(event.target.checked)}
                  />
                  영어도 함께 보기
                </label>
              )}
              {images.urls[1] && (
                <img
                  src={images.urls[1]}
                  alt="동화의 그림"
                  className="max-w-lg w-full rounded-lg mb-6"
                />
              )}
              <MessageDisplay
                messages={messages}
                isShowEnglish={showEnglish}
                useGoogleTTS={false}
                voice="female"
              />
            </>
          ) : (
            thread &&
            !loadFailed && (
              <div className="empty-state">
                <h1>아직 이야기가 담기지 않았어요.</h1>
                <Link className="button-primary mt-5" href="/service">
                  새 그림책 만들기
                </Link>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

/* eslint-disable no-nested-ternary */
// Render branches are mutually exclusive; handlers are direct, unmemoized UI actions.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";

import threadApi from "@/app/api/thread";
import GuideForSign from "@/app/components/GuideForSign";
import type { ThreadWithUser } from "@/app/types/openai";
import { formatTime } from "@/app/utils";
import { parsePicturebookDraft } from "@/app/utils/picturebook";
import useUserInfo from "@/services/hooks/use-user-info";

const pageSize = 24;

export default function MyStory() {
  const { userInfo } = useUserInfo();
  const [threads, setThreads] = useState<ThreadWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [loadedOwner, setLoadedOwner] = useState<string>();
  const nextBook = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (visibleCount > pageSize) nextBook.current?.focus();
  }, [visibleCount]);
  useEffect(() => {
    setThreads([]);
    setQuery("");
    setFilter("all");
    setVisibleCount(pageSize);
    setLoadedOwner(undefined);
    if (!userInfo.id) return undefined;
    let active = true;
    setLoading(true);
    setError("");
    setThreads([]);
    threadApi
      .fetchThreadsByUserId({ user_id: userInfo.id })
      .then(data => {
        if (active) {
          setThreads(data);
          setLoadedOwner(userInfo.id);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "책장을 불러오지 못했어요. 연결을 확인하고 다시 시도해주세요.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userInfo.id, retry]);
  const books = useMemo(
    () =>
      threads
        .map(thread => {
          const book = parsePicturebookDraft(thread.raw_text);
          return {
            thread,
            book,
            status:
              book?.status || (thread.messages?.length ? "legacy" : "empty"),
            title:
              book?.title ||
              thread.keywords?.map(keyword => keyword.keyword).join(", ") ||
              "제목 없는 이야기",
          };
        })
        .filter(
          ({ book, title, status }) =>
            (!query.trim() ||
              `${title} ${book?.childName || ""} ${book?.situation || ""}`
                .toLowerCase()
                .includes(query.trim().toLowerCase())) &&
            (filter === "all" ? status !== "empty" : status === filter),
        ),
    [threads, query, filter],
  );
  if (!userInfo.id) return <GuideForSign />;
  return (
    <div className="page-shell">
      <div className="library-header">
        <div className="page-heading mb-0">
          <p className="eyebrow">함께 읽은 시간이 쌓이는 곳</p>
          <h1>내 책장</h1>
          <p>오늘 만든 이야기부터, 다시 읽고 싶은 이야기까지.</p>
        </div>
        <Link href="/service" className="button-primary">
          새 그림책 만들기 ↗
        </Link>
      </div>
      {!loading && loadedOwner === userInfo.id && threads.length > 0 && (
        <div className="library-tools">
          <label className="sr-only" htmlFor="book-search">
            제목, 아이 이름, 상황으로 검색
          </label>
          <input
            id="book-search"
            type="search"
            value={query}
            onChange={event => {
              setQuery(event.target.value);
              setVisibleCount(pageSize);
            }}
            placeholder="제목, 아이 이름, 상황으로 검색"
          />
          <label className="sr-only" htmlFor="book-filter">
            완성 상태
          </label>
          <select
            id="book-filter"
            value={filter}
            onChange={event => {
              setFilter(event.target.value);
              setVisibleCount(pageSize);
            }}
          >
            <option value="all">읽을 수 있는 이야기</option>
            <option value="complete">완성된 그림책</option>
            <option value="choice-ready">이어 만들 그림책</option>
            <option value="legacy">예전에 만든 동화</option>
            <option value="empty">내용 확인이 필요한 기록</option>
          </select>
        </div>
      )}
      {loading || (!error && loadedOwner !== userInfo.id) ? (
        <p className="empty-state" role="status">
          책장에서 이야기를 꺼내고 있어요.
        </p>
      ) : error ? (
        <div className="notice-error mt-8" role="alert">
          {error}
          <button
            type="button"
            className="button-secondary mt-4 block"
            onClick={() => setRetry(value => value + 1)}
          >
            다시 불러오기
          </button>
        </div>
      ) : !threads.length ? (
        <div className="empty-state mt-8">
          <h2>첫 번째 이야기를 기다리고 있어요.</h2>
          <p>
            아이의 하루를 담은 그림책 한 권으로
            <br />
            우리만의 책장을 시작해보세요.
          </p>
          <Link href="/service" className="button-primary">
            첫 그림책 만들기
          </Link>
          <Link className="text-link block mt-5" href="/sample">
            예시 그림책 읽기
          </Link>
        </div>
      ) : !books.length ? (
        <div className="empty-state">
          <h2>찾는 이야기가 없어요.</h2>
          <p>검색어나 완성 상태를 바꿔보세요.</p>
          <button
            className="button-secondary"
            type="button"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
          >
            전체 이야기 보기
          </button>
        </div>
      ) : (
        <>
          <p role="status" className="text-sm text-gray-600 mb-4">
            {books.length}
            {filter === "empty" ? "개 기록" : "권"} · 최근에 만든 순
            {books.length > pageSize &&
              ` · ${Math.min(visibleCount, books.length)}${filter === "empty" ? "개" : "권"} 표시 중`}
          </p>
          <div className="book-list">
            {books
              .slice(0, visibleCount)
              .map(({ thread, book, title, status }, index) => (
                <Link
                  href={`/my-story/${thread.id}`}
                  key={thread.id}
                  ref={index === visibleCount - pageSize ? nextBook : undefined}
                >
                  <small>
                    {formatTime(thread.created_at, "YYYY.MM.DD")}
                    {book ? ` · ${book.childName}의 이야기` : ""}
                  </small>
                  <h2>{title}</h2>
                  {book && <p className="line-clamp-2">{book.situation}</p>}
                  <footer>
                    <span>
                      {book?.status === "choice-ready"
                        ? "첫 4쪽 · 결말을 골라주세요"
                        : book
                          ? "8쪽 · 완성"
                          : status === "legacy"
                            ? "저장된 동화"
                            : thread.raw_text?.trim()
                              ? "내용 확인 필요"
                              : "내용이 없는 기록"}
                    </span>
                    <span>
                      {book?.status === "choice-ready"
                        ? "이어 만들기"
                        : status === "empty"
                          ? "상태 확인"
                          : "읽기"}{" "}
                      ↗
                    </span>
                  </footer>
                </Link>
              ))}
          </div>
          {visibleCount < books.length && (
            <div className="text-center mt-8">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setVisibleCount(count => count + pageSize)}
              >
                이야기 더 보기 · {books.length - visibleCount}
                {filter === "empty" ? "개" : "권"} 남음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

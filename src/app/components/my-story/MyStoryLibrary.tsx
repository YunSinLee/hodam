/* eslint-disable no-nested-ternary */
// Render branches are mutually exclusive; handlers are direct, unmemoized UI actions.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import Image from "next/image";
import Link from "next/link";

import imageApi from "@/app/api/image";
import threadApi from "@/app/api/thread";
import GuideForSign from "@/app/components/GuideForSign";
import type { ThreadWithUser } from "@/app/types/openai";
import { formatTime } from "@/app/utils";
import { parsePicturebookDraft } from "@/app/utils/picturebook";
import {
  adventureCompanions,
  adventureWorlds,
} from "@/lib/picturebook/adventure";
import {
  compareLibraryEntries,
  getBookReadingStatus,
  getChildShelfKey,
} from "@/lib/picturebook/library-discovery";
import useReadingSync from "@/services/hooks/use-reading-sync";
import useUserInfo from "@/services/hooks/use-user-info";

import styles from "./library-discovery.module.css";
import LibraryTools, {
  initialLibraryFilters,
  librarySortLabels,
} from "./LibraryTools";
import ReadingSyncNotice from "./ReadingSyncNotice";

const pageSize = 24;
type BookPreviews = Awaited<ReturnType<typeof imageApi.getBookPreviews>>;

export default function MyStoryLibrary({
  archived = false,
}: {
  archived?: boolean;
}) {
  const { userInfo, isAuthReady } = useUserInfo();
  const [previews, setPreviews] = useState<BookPreviews>({});
  const previewCache = useRef<{
    owner?: string;
    expiresAt: number;
    values: BookPreviews;
  }>({ expiresAt: 0, values: {} });
  const [previewsReady, setPreviewsReady] = useState(false);
  const [threads, setThreads] = useState<ThreadWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(initialLibraryFilters);
  const {
    completion: filter,
    child: selectedChild,
    reading: readingFilter,
    sort,
  } = filters;
  const [shelfView, setShelfView] = useState("all");
  const [preferenceNotice, setPreferenceNotice] = useState("");
  const reading = useReadingSync(userInfo.id);
  const readingBooks = reading.books;
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [loadedOwner, setLoadedOwner] = useState<string>();
  const nextBook = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (visibleCount > pageSize) nextBook.current?.focus();
  }, [visibleCount]);
  useEffect(() => {
    setPreferenceNotice("");
  }, [userInfo.id]);
  useEffect(() => {
    setThreads([]);
    setQuery("");
    setFilters(initialLibraryFilters);
    setShelfView("all");
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
  }, [userInfo.id, retry, archived]);
  const entries = useMemo(
    () =>
      threads.map(thread => {
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
      }),
    [threads],
  );
  const archivedCount = entries.filter(entry => !entry.book).length;
  const collection = useMemo(
    () => entries.filter(entry => (archived ? !entry.book : !!entry.book)),
    [entries, archived],
  );
  const onlyEmptyRecords =
    archived &&
    collection.length > 0 &&
    collection.every(entry => entry.status === "empty");
  const childOptions = useMemo(() => {
    const counts = new Map<string, number>();
    collection.forEach(({ book }) => {
      if (!book) return;
      const name = getChildShelfKey(book.childName);
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return Array.from(counts, ([name, count]) => ({ name, count })).sort(
      (left, right) => left.name.localeCompare(right.name, "ko"),
    );
  }, [collection]);
  const books = useMemo(
    () =>
      collection
        .filter(
          ({ thread, book, title, status }) =>
            (!query.trim() ||
              `${title} ${book?.childName || ""} ${book?.situation || ""} ${book?.adventure?.companionName || ""} ${book?.adventure ? adventureCompanions[book.adventure.companion].label : ""}`
                .normalize("NFC")
                .toLowerCase()
                .includes(query.trim().normalize("NFC").toLowerCase())) &&
            (shelfView !== "favorites" || readingBooks[thread.id]?.favorite) &&
            (!selectedChild ||
              (book && getChildShelfKey(book.childName) === selectedChild)) &&
            (readingFilter === "all" ||
              (book &&
                getBookReadingStatus(book, readingBooks[thread.id]) ===
                  readingFilter)) &&
            (filter === "all" ? status !== "empty" : status === filter),
        )
        .sort((left, right) =>
          compareLibraryEntries(sort, left, right, readingBooks),
        ),
    [
      collection,
      query,
      filter,
      shelfView,
      readingBooks,
      selectedChild,
      readingFilter,
      sort,
    ],
  );
  const visibleBooks = useMemo(
    () => books.slice(0, visibleCount),
    [books, visibleCount],
  );
  const resumeBook = !archived
    ? books
        .filter(({ thread, book }) => {
          const progress = readingBooks[thread.id];
          return (
            book &&
            progress &&
            getBookReadingStatus(book, progress) === "reading" &&
            (progress.pageIndex || 0) > 0 &&
            progress.pageIndex! < book.pages.length
          );
        })
        .sort(
          (left, right) =>
            (readingBooks[right.thread.id]?.updatedAt || 0) -
            (readingBooks[left.thread.id]?.updatedAt || 0),
        )[0]
    : undefined;
  const bookGroups = useMemo(() => {
    if (shelfView !== "companions")
      return [
        ["all", { label: "", description: "", books: visibleBooks }],
      ] as const;
    const groups = new Map<
      string,
      { label: string; description: string; books: typeof visibleBooks }
    >();
    visibleBooks.forEach(entry => {
      const adventure = entry.book?.adventure;
      const groupId = adventure
        ? JSON.stringify([
            getChildShelfKey(entry.book!.childName),
            adventure.companion,
            adventure.companionName,
          ])
        : "everyday";
      const group = groups.get(groupId) || {
        label: adventure
          ? `${getChildShelfKey(entry.book!.childName)} · ${adventureCompanions[adventure.companion].label} ${adventure.companionName}`
          : "하루를 담은 그림책",
        description: adventure
          ? `${adventureCompanions[adventure.companion].label} 단짝과 떠난 각각의 모험이에요.`
          : "일상 속 마음과 작은 발견을 다시 만나요.",
        books: [],
      };
      group.books.push(entry);
      groups.set(groupId, group);
    });
    return Array.from(groups.entries());
  }, [visibleBooks, shelfView]);
  const BookHeading = shelfView === "companions" ? "h3" : "h2";
  const favoriteCount = collection.filter(
    ({ thread }) => readingBooks[thread.id]?.favorite,
  ).length;
  useEffect(() => {
    let active = true;
    if (
      previewCache.current.owner !== userInfo.id ||
      previewCache.current.expiresAt <= Date.now()
    ) {
      previewCache.current = {
        owner: userInfo.id,
        expiresAt: Date.now() + 55 * 60_000,
        values: {},
      };
    }
    setPreviews(previewCache.current.values);
    setPreviewsReady(false);
    if (archived || loadedOwner !== userInfo.id) return undefined;
    const requests = visibleBooks.flatMap(({ thread, book }) =>
      book && thread.has_image && !previewCache.current.values[thread.id]
        ? [
            {
              threadId: thread.id,
              pageNumbers: book.pages.map(page => page.pageNumber),
            },
          ]
        : [],
    );
    if (!requests.length) {
      setPreviewsReady(true);
      return undefined;
    }
    imageApi
      .getBookPreviews(requests)
      .then(result => {
        if (active) {
          previewCache.current.values = {
            ...previewCache.current.values,
            ...result,
          };
          setPreviews(previewCache.current.values);
        }
      })
      .catch(() => {
        /* A cover failure must not prevent reading the saved story. */
      })
      .finally(() => {
        if (active) setPreviewsReady(true);
      });
    return () => {
      active = false;
    };
  }, [archived, loadedOwner, userInfo.id, visibleBooks]);
  if (!isAuthReady)
    return (
      <div className="page-shell" role="status">
        책장을 준비하고 있어요.
      </div>
    );
  if (!userInfo.id) return <GuideForSign />;
  return (
    <div className="page-shell library-shell">
      {archived && (
        <Link className="text-link inline-block mb-6" href="/my-story">
          ← 내 그림책으로 돌아가기
        </Link>
      )}
      <div className="library-header">
        <div className="page-heading mb-0">
          <h1>{archived ? "예전 동화 보관함" : "내 책장"}</h1>
          <p>
            {archived
              ? "예전에 만든 동화를 저장한 모습 그대로 읽을 수 있어요."
              : "아이의 하루를 담은 그림책을 이어 만들고, 다시 읽어요."}
          </p>
        </div>
        <Link href="/service" className="button-primary">
          새 그림책 만들기 ↗
        </Link>
      </div>
      {!loading &&
        !error &&
        loadedOwner === userInfo.id &&
        !archived &&
        archivedCount > 0 && (
          <aside className="library-archive-link">
            <Link className="text-link" href="/my-story/archive">
              예전 동화 보관함 · {archivedCount}개 ↗
            </Link>
          </aside>
        )}
      {!loading && loadedOwner === userInfo.id && collection.length > 0 && (
        <>
          {!archived && (
            <div className={styles.discovery}>
              <div className={styles.views} aria-label="책장 보기 방식">
                {[
                  ["all", "전체 책장"],
                  [
                    "favorites",
                    `좋아하는 책${favoriteCount ? ` · ${favoriteCount}` : ""}`,
                  ],
                  ["companions", "단짝 모아보기"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={shelfView === value}
                    onClick={() => {
                      setShelfView(value);
                      setVisibleCount(pageSize);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <ReadingSyncNotice sync={reading} />
            </div>
          )}
          <LibraryTools
            key={`${userInfo.id}:${archived}`}
            archived={archived}
            query={query}
            onQueryChange={value => {
              setQuery(value);
              setVisibleCount(pageSize);
            }}
            filters={filters}
            onFiltersChange={value => {
              setFilters(value);
              setVisibleCount(pageSize);
            }}
            childOptions={childOptions}
          />
        </>
      )}
      {!loading && !error && loadedOwner === userInfo.id && resumeBook && (
        <section
          className={styles.resume}
          aria-labelledby="resume-book-heading"
        >
          <div>
            <p className={styles.eyebrow}>마지막으로 펼친 책</p>
            <h2 id="resume-book-heading">{resumeBook.title}</h2>
            <p>
              {readingBooks[resumeBook.thread.id].pageIndex! + 1}쪽에 책갈피가
              있어요.
            </p>
          </div>
          <Link
            href={`/my-story/${resumeBook.thread.id}#continue-reading`}
            className="button-secondary"
          >
            읽던 그림책 열기 ↗
          </Link>
        </section>
      )}
      {preferenceNotice && (
        <p className="notice-error mb-4" role="status">
          {preferenceNotice}
        </p>
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
      ) : !collection.length ? (
        <div className="empty-state mt-8">
          <h2>
            {archived
              ? "보관된 예전 동화가 없어요."
              : "첫 번째 이야기를 기다리고 있어요."}
          </h2>
          <p>
            {archived
              ? "최근에 만든 그림책은 내 책장에서 만날 수 있어요."
              : "아이의 하루를 담은 8쪽 그림책으로 우리만의 책장을 시작해보세요."}
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
          <h2>
            {onlyEmptyRecords
              ? "내용 확인이 필요한 기록이 있어요."
              : shelfView === "favorites" &&
                  !query.trim() &&
                  filter === "all" &&
                  !selectedChild &&
                  readingFilter === "all"
                ? "다시 읽고 싶은 책을 골라보세요."
                : "찾는 이야기가 없어요."}
          </h2>
          <p>
            {onlyEmptyRecords
              ? "읽을 수 있는 글이 없는 기록도 보관하고 있어요."
              : shelfView === "favorites" &&
                  !query.trim() &&
                  filter === "all" &&
                  !selectedChild &&
                  readingFilter === "all"
                ? "표지의 하트를 누르면 좋아하는 책만 모아볼 수 있어요."
                : "검색어나 책장 보기 방식을 바꿔보세요."}
          </p>
          <button
            className="button-secondary"
            type="button"
            onClick={() => {
              setQuery("");
              setFilters({
                ...initialLibraryFilters,
                completion: onlyEmptyRecords ? "empty" : "all",
              });
              setShelfView("all");
              setVisibleCount(pageSize);
            }}
          >
            {onlyEmptyRecords ? "보관된 기록 보기" : "전체 이야기 보기"}
          </button>
        </div>
      ) : (
        <>
          <p role="status" className="text-sm text-gray-600 mb-4">
            {books.length}
            {filter === "empty" ? "개 기록" : "권"} · {librarySortLabels[sort]}
            {books.length > pageSize &&
              ` · ${Math.min(visibleCount, books.length)}${filter === "empty" ? "개" : "권"} 표시 중`}
          </p>
          {bookGroups.map(([groupId, group]) => (
            <section
              key={groupId}
              className={styles.group}
              aria-label={group.label || undefined}
            >
              {shelfView === "companions" && (
                <div className={styles.groupHeading}>
                  <h2>{group.label}</h2>
                  <p>{group.description}</p>
                </div>
              )}
              <div className="book-list">
                {group.books.map(({ thread, book, title, status }) => (
                  <article key={thread.id} className={styles.bookCard}>
                    <Link
                      href={`/my-story/${thread.id}`}
                      className={styles.bookLink}
                      ref={
                        thread.id ===
                        visibleBooks[visibleCount - pageSize]?.thread.id
                          ? nextBook
                          : undefined
                      }
                    >
                      {book && (
                        <div className="shelf-cover">
                          {previews[thread.id]?.coverUrl ? (
                            <Image
                              src={previews[thread.id].coverUrl!}
                              alt=""
                              width={480}
                              height={360}
                              unoptimized
                              onError={() =>
                                setPreviews(current => ({
                                  ...current,
                                  [thread.id]: {
                                    ...current[thread.id],
                                    coverUrl: null,
                                  },
                                }))
                              }
                            />
                          ) : (
                            <div
                              className="shelf-cover-fallback"
                              aria-hidden="true"
                            >
                              <span>호담의 작은 책</span>
                              <strong>{title}</strong>
                              <span>
                                {book.childName}의{" "}
                                {book.adventure ? "모험" : "하루"}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="shelf-book-info">
                        <small>
                          {formatTime(thread.created_at, "YYYY.MM.DD")}
                          {book ? ` · ${book.childName}의 이야기` : ""}
                        </small>
                        <BookHeading className={styles.bookTitle}>
                          {title}
                        </BookHeading>
                        {book && (
                          <p className="line-clamp-2">
                            {book.adventure
                              ? `${adventureWorlds[book.adventure.world].label} · 단짝 ${book.adventure.companionName}`
                              : book.situation}
                          </p>
                        )}
                        <footer>
                          <span>
                            {book?.status === "choice-ready"
                              ? "첫 4쪽 · 결말을 골라주세요"
                              : book
                                ? `${book.pages.length}쪽 · 이야기 완성`
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
                        {book && (
                          <div className={styles.bookMeta}>
                            <span
                              className={styles.readingStatus}
                              data-status={getBookReadingStatus(
                                book,
                                readingBooks[thread.id],
                              )}
                            >
                              {getBookReadingStatus(
                                book,
                                readingBooks[thread.id],
                              ) === "finished"
                                ? "끝까지 읽었어요"
                                : getBookReadingStatus(
                                      book,
                                      readingBooks[thread.id],
                                    ) === "reading"
                                  ? `${readingBooks[thread.id].pageIndex! + 1}/${book.pages.length}쪽 읽는 중`
                                  : "아직 책갈피 없음"}
                            </span>
                            <span>
                              {previews[thread.id] || !thread.has_image
                                ? `그림 ${previews[thread.id]?.imageCount || 0}/${book.pages.length}장`
                                : previewsReady
                                  ? "그림은 책에서 확인해요"
                                  : "그림 확인 중…"}
                            </span>
                          </div>
                        )}
                      </div>
                    </Link>
                    {book && (
                      <button
                        type="button"
                        className={styles.favorite}
                        aria-label={`${title} 좋아하는 책${readingBooks[thread.id]?.favorite ? "에서 빼기" : "에 담기"}`}
                        aria-pressed={!!readingBooks[thread.id]?.favorite}
                        onClick={() => {
                          const saved = reading.setFavorite(
                            thread.id,
                            !readingBooks[thread.id]?.favorite,
                          );
                          setPreferenceNotice(
                            saved
                              ? ""
                              : "좋아하는 책을 저장하지 못했어요. 잠시 후 다시 시도해주세요.",
                          );
                        }}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="21"
                          height="21"
                          fill={
                            readingBooks[thread.id]?.favorite
                              ? "currentColor"
                              : "none"
                          }
                          stroke="currentColor"
                          strokeWidth="1.6"
                          aria-hidden="true"
                        >
                          <path d="M20.8 4.6a5.6 5.6 0 0 0-7.9 0L12 5.5l-.9-.9a5.6 5.6 0 0 0-7.9 7.9L12 21l8.8-8.5a5.6 5.6 0 0 0 0-7.9Z" />
                        </svg>
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
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

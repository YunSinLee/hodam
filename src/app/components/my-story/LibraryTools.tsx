import { useRef, useState } from "react";
import type { RefObject } from "react";

import type {
  BookReadingStatus,
  LibrarySort,
} from "@/lib/picturebook/library-discovery";

import styles from "./library-discovery.module.css";

export interface LibraryFilters {
  child: string;
  reading: BookReadingStatus | "all";
  completion: "all" | "complete" | "choice-ready" | "empty";
  sort: LibrarySort;
}

export const initialLibraryFilters: LibraryFilters = {
  child: "",
  reading: "all",
  completion: "all",
  sort: "newest",
};

export const librarySortLabels: Record<LibrarySort, string> = {
  newest: "최근에 만든 순",
  oldest: "오래된 책부터",
  "recently-read": "최근 읽은 순",
  title: "제목 가나다순",
};

const readingLabels = {
  all: "모든 읽기 기록",
  unread: "책갈피 없는 책",
  reading: "읽는 중인 책",
  finished: "끝까지 읽은 책",
};

export default function LibraryTools({
  archived,
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  childOptions,
  searchRef,
}: {
  archived: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  filters: LibraryFilters;
  onFiltersChange: (filters: LibraryFilters) => void;
  childOptions: { name: string; count: number }[];
  searchRef: RefObject<HTMLInputElement>;
}) {
  const [expanded, setExpanded] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const selections = [
    filters.child && `${filters.child}의 책`,
    filters.reading !== "all" && readingLabels[filters.reading],
    filters.completion !== "all" &&
      (filters.completion === "complete" ? "결말까지 쓴 책" : "이어 만들 책"),
    filters.sort !== "newest" && librarySortLabels[filters.sort],
  ].filter(Boolean);
  const completionSelect = (
    <select
      id="book-filter"
      value={filters.completion}
      onChange={event =>
        onFiltersChange({
          ...filters,
          completion: event.target.value as LibraryFilters["completion"],
        })
      }
    >
      {archived ? (
        <>
          <option value="all">읽을 수 있는 동화</option>
          <option value="empty">내용 확인이 필요한 기록</option>
        </>
      ) : (
        <>
          <option value="all">모든 그림책</option>
          <option value="complete">결말까지 쓴 그림책</option>
          <option value="choice-ready">이어 만들 그림책</option>
        </>
      )}
    </select>
  );

  return (
    <div className={styles.tools}>
      <div
        className={`library-tools ${styles.searchRow} ${archived ? "" : styles.picturebookSearch}`}
      >
        <label className="sr-only" htmlFor="book-search">
          {archived
            ? "키워드로 예전 동화 찾기"
            : "제목, 아이 이름, 단짝 이름, 상황으로 검색"}
        </label>
        <input
          ref={searchRef}
          id="book-search"
          type="search"
          value={query}
          onChange={event => onQueryChange(event.target.value)}
          placeholder={
            archived
              ? "키워드로 예전 동화 찾기"
              : "제목, 아이 이름, 단짝 이름으로 찾기"
          }
        />
        {archived ? (
          <>
            <label className="sr-only" htmlFor="book-filter">
              완성 상태
            </label>
            {completionSelect}
          </>
        ) : (
          <button
            ref={toggleRef}
            type="button"
            className={styles.filterToggle}
            aria-expanded={expanded}
            aria-controls="library-filters"
            onClick={() => setExpanded(value => !value)}
          >
            책장 정리{selections.length > 0 ? ` · ${selections.length}` : ""}
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="m4 6 4 4 4-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </button>
        )}
      </div>
      {!archived && (
        <>
          <div
            id="library-filters"
            className={styles.filters}
            hidden={!expanded}
            role="region"
            aria-label="책장 정리"
          >
            <label htmlFor="book-child">
              아이 이름별로
              <select
                id="book-child"
                value={filters.child}
                onChange={event =>
                  onFiltersChange({ ...filters, child: event.target.value })
                }
              >
                <option value="">모든 아이의 책</option>
                {childOptions.map(child => (
                  <option key={child.name} value={child.name}>
                    {child.name} · {child.count}권
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="book-reading">
              읽기 상태
              <select
                id="book-reading"
                value={filters.reading}
                onChange={event =>
                  onFiltersChange({
                    ...filters,
                    reading: event.target.value as LibraryFilters["reading"],
                  })
                }
              >
                {Object.entries(readingLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="book-filter">
              완성 상태
              {completionSelect}
            </label>
            <label htmlFor="book-sort">
              책 순서
              <select
                id="book-sort"
                value={filters.sort}
                onChange={event =>
                  onFiltersChange({
                    ...filters,
                    sort: event.target.value as LibrarySort,
                  })
                }
              >
                {Object.entries(librarySortLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <p className={styles.filterHint}>
              책에 적힌 아이 이름으로 모아요. 책갈피를 남긴 기록을 기준으로
              구분해요.
            </p>
          </div>
          {selections.length > 0 && (
            <div className={styles.activeFilters}>
              <p>{selections.join(" · ")}</p>
              <button
                type="button"
                onClick={() => {
                  onFiltersChange(initialLibraryFilters);
                  toggleRef.current?.focus();
                }}
              >
                조건 초기화
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

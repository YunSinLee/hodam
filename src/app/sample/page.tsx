/* eslint-disable react/jsx-no-bind */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Link from "next/link";

import PicturebookViewer from "@/app/components/picturebook/PicturebookViewer";
import type { PicturebookChoiceOption } from "@/app/types/openai";
import {
  trackFirstBookStep,
  trackSearchCta,
} from "@/lib/client/search-analytics";
import {
  createSampleBook,
  normalizeSampleName,
  prepareSampleStarter,
} from "@/lib/picturebook/sample";

export default function SamplePage() {
  const [book, setBook] = useState(() => createSampleBook());
  const [name, setName] = useState("");
  const [appliedName, setAppliedName] = useState("");
  const [hasFinished, setHasFinished] = useState(false);
  const tracked = useRef(new Set<string>());
  const trackOnce = useCallback(
    (
      step:
        | "sample_opened"
        | "sample_personalized"
        | "sample_choice"
        | "sample_completed",
    ) => {
      if (tracked.current.has(step)) return;
      tracked.current.add(step);
      trackFirstBookStep(step, "sample");
    },
    [],
  );
  useEffect(() => trackOnce("sample_opened"), [trackOnce]);
  const finishReading = useCallback(() => {
    setHasFinished(true);
    trackOnce("sample_completed");
  }, [trackOnce]);

  function choose(id: PicturebookChoiceOption["id"]) {
    setBook(createSampleBook(book.childName, id));
    trackOnce("sample_choice");
  }
  function startOwnBook() {
    // Only an explicitly entered name is carried into the creation form.
    if (appliedName) prepareSampleStarter(appliedName);
    trackSearchCta("sample");
  }
  return (
    <div className="page-shell sample-shell">
      <div className="sample-intro">
        <p className="eyebrow">호담 무료 체험 · 로그인 없이 끝까지</p>
        <p>이야기 속 아이가 되어, 다음 장면을 함께 골라보세요.</p>
      </div>
      <form
        className="sample-personalize"
        onSubmit={event => {
          event.preventDefault();
          const nextName = normalizeSampleName(name);
          setBook(createSampleBook(nextName, book.selectedChoiceId));
          setAppliedName(name.trim() ? nextName : "");
          if (name.trim()) trackOnce("sample_personalized");
        }}
      >
        <div>
          <label htmlFor="sample-child-name">
            우리 아이 별명으로 읽어볼까요?
          </label>
          <p id="sample-name-help">
            이름만 바뀌는 예시예요. 이야기와 그림은 미리 준비되어 있어요.
          </p>
        </div>
        <div className="sample-name-fields">
          <input
            id="sample-child-name"
            value={name}
            onChange={event => setName(event.target.value)}
            maxLength={20}
            placeholder="별명 (선택)"
            autoComplete="off"
            aria-describedby="sample-name-help"
          />
          <button type="submit" className="button-secondary">
            이 이름으로 읽기
          </button>
        </div>
        {appliedName && (
          <p className="sample-name-feedback" role="status">
            {appliedName}의 이름으로 바뀌었어요.
          </p>
        )}
      </form>
      <PicturebookViewer
        headingLevel={1}
        createAnotherLabel="처음부터 다시 읽기"
        picturebook={book}
        imageUrls={Object.fromEntries(
          book.pages.map(page => [
            page.pageNumber,
            `/sample/little-courage/page-${page.pageNumber}${page.pageNumber === 5 ? `-${book.selectedChoiceId?.toLowerCase()}` : ""}.webp`,
          ]),
        )}
        selectedChoiceId={book.selectedChoiceId}
        onSelectChoice={choose}
        onReadComplete={finishReading}
        onCreateAnother={() => {
          setBook(createSampleBook(book.childName));
          setHasFinished(false);
        }}
      />
      <section className="sample-next" aria-labelledby="sample-next-title">
        <p className="eyebrow">다음 이야기는 우리 아이의 하루로</p>
        <h2 id="sample-next-title">
          {hasFinished ? "작은 용기를 내본 다음에는," : "오늘 우리 아이에게도,"}
          <br />
          어떤 이야기가 필요할까요?
        </h2>
        <p>
          아이의 나이와 오늘 있었던 일을 담아 새 이야기를 만들어요.
          <br />첫 4쪽을 읽고 선택하면, 그 마음을 따라 결말이 이어져요.
        </p>
        <Link className="button-primary" href="/service" onClick={startOwnBook}>
          우리 아이 그림책 만들기 <span aria-hidden="true">↗</span>
        </Link>
        <p className="field-help">
          8쪽 그림책 · 곶감 1개 · 결말 선택에 추가 사용 없음
        </p>
      </section>
    </div>
  );
}

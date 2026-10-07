import { useId, useRef } from "react";

import Link from "next/link";

import type { PicturebookInput, PicturebookTone } from "@/app/types/openai";
import {
  situationExamples,
  validatePicturebookInput,
} from "@/app/utils/picturebook";
import { defaultAdventure } from "@/lib/picturebook/adventure";

import AdventureFields from "./AdventureFields";

interface PicturebookInputFormProps {
  value: PicturebookInput;
  picturebookCost: number;
  beadCount?: number;
  isLoading: boolean;
  isSignedIn?: boolean;
  isAuthReady?: boolean;
  fromSample?: boolean;
  onChange: (value: PicturebookInput) => void;
  onSubmit: () => void;
}
const tones: { value: PicturebookTone; label: string }[] = [
  { value: "calm", label: "차분하고 포근하게" },
  { value: "playful", label: "재미있고 다정하게" },
  { value: "brave", label: "작은 용기를 담아" },
];
export default function PicturebookInputForm({
  value,
  picturebookCost,
  beadCount,
  isLoading,
  isSignedIn = true,
  isAuthReady = true,
  fromSample = false,
  onChange,
  onSubmit,
}: PicturebookInputFormProps) {
  const formId = useId();
  const submitHelpId = `${formId}-submit-help`;
  const identityHelpId = `${formId}-identity-help`;
  const situationHelpId = `${formId}-situation-help`;
  const invalid = validatePicturebookInput(value);
  const isAdventure = !!value.adventure;
  const previousDaily = useRef({
    situation: value.situation,
    lesson: value.lesson,
  });
  const previousAdventure = useRef({
    adventure: { ...defaultAdventure },
    situation: "",
    lesson: "",
  });
  function switchMode(adventure: boolean) {
    if (adventure === isAdventure) return;
    if (adventure) {
      previousDaily.current = {
        situation: value.situation,
        lesson: value.lesson,
      };
      onChange({ ...value, ...previousAdventure.current });
    } else {
      previousAdventure.current = {
        adventure: value.adventure!,
        situation: value.situation,
        lesson: value.lesson,
      };
      onChange({ ...value, ...previousDaily.current, adventure: undefined });
    }
  }
  function update<Key extends keyof PicturebookInput>(
    key: Key,
    next: PicturebookInput[Key],
  ) {
    onChange({ ...value, [key]: next });
  }
  let balanceLabel = "로그인 정보를 확인하고 있어요";
  if (isAuthReady) {
    balanceLabel = isSignedIn
      ? `보유 곶감 ${beadCount === undefined ? "확인 중" : `${beadCount}개`}`
      : "로그인 후 보유 곶감을 확인할 수 있어요";
  }
  let submitLabel = "로그인 정보를 확인하고 있어요…";
  if (isAuthReady && isLoading) {
    submitLabel = "그림책을 만들고 있어요…";
  } else if (isAuthReady) {
    submitLabel = isAdventure
      ? "우리의 모험 그림책 만들기"
      : "오늘 밤 그림책 만들기";
    if (!isSignedIn) submitLabel = "로그인하고 그림책 만들기";
  }
  return (
    <form
      className="creation-form"
      aria-busy={isLoading}
      onSubmit={event => {
        event.preventDefault();
        if (isAuthReady && !isLoading && !invalid) onSubmit();
      }}
    >
      <div className="page-heading">
        <p className="eyebrow">오늘 밤, 우리 아이가 주인공</p>
        <h1 tabIndex={-1}>
          {isAdventure
            ? "오늘은 어떤 모험을 떠날까요?"
            : "어떤 하루를 보냈나요?"}
        </h1>
        <p>
          {isAdventure
            ? "아이와 단짝이 주인공인 이야기. 장소를 고르면 모험이 시작돼요."
            : "이름과 오늘의 한 장면을 알려주세요. 아이가 주인공인 이야기를 만들어요."}
        </p>
      </div>
      <div className="story-mode" role="group" aria-label="이야기 종류">
        <button
          type="button"
          aria-pressed={!isAdventure}
          disabled={isLoading}
          onClick={() => switchMode(false)}
        >
          오늘의 이야기<span>하루의 한 장면을 담아요</span>
        </button>
        <button
          type="button"
          aria-pressed={isAdventure}
          disabled={isLoading}
          onClick={() => switchMode(true)}
        >
          단짝과 상상 모험<span>가고 싶은 세상을 골라요</span>
        </button>
      </div>
      <div className="creation-expectation">
        <p>
          <strong>8쪽 그림책 한 권 · 곶감 {picturebookCost}개</strong>
        </p>
        <p>첫 4쪽 → 아이와 함께 선택 → 결말 4쪽과 내 책장 보관</p>
        <Link href="/sample" className="text-link">
          완성된 예시 먼저 읽기 ↗
        </Link>
      </div>
      <section className="form-section">
        <h2>
          <span>01</span>이야기의 주인공
        </h2>
        <div className="field-row">
          <label className="field">
            <span>이름 또는 별명</span>
            <input
              name="childName"
              value={value.childName}
              onChange={event => update("childName", event.target.value)}
              maxLength={20}
              required
              placeholder="예: 민준"
              autoComplete="off"
              aria-describedby={identityHelpId}
              disabled={isLoading}
            />
          </label>
          <label className="field">
            <span>나이</span>
            <select
              name="childAge"
              value={value.childAge}
              onChange={event => update("childAge", event.target.value)}
              required
              disabled={isLoading}
            >
              <option value="">선택</option>
              {Array.from({ length: 10 }, (_, i) => i + 3).map(age => (
                <option key={age} value={String(age)}>
                  {age}세
                </option>
              ))}
            </select>
          </label>
        </div>
        <p id={identityHelpId} className="field-help">
          실명 대신 별명도 좋아요. 주소나 연락처는 적지 않아도 돼요.
        </p>
      </section>
      {value.adventure ? (
        <AdventureFields
          value={{ ...value, adventure: value.adventure }}
          disabled={isLoading}
          onChange={onChange}
        />
      ) : (
        <section className="form-section">
          <h2>
            <span>02</span>오늘의 작은 순간
          </h2>
          {fromSample && (
            <p className="field-help mb-4">
              무료 체험의 상황을 가져왔어요. 오늘 있었던 일에 맞게 고쳐주세요.
            </p>
          )}
          <div className="example-buttons" aria-label="상황 예시">
            {Object.entries(situationExamples).map(([key, example]) => (
              <button
                key={key}
                type="button"
                disabled={isLoading}
                onClick={() =>
                  onChange({
                    ...value,
                    situation: example.situation,
                    lesson: example.lesson,
                  })
                }
              >
                {example.label}
              </button>
            ))}
          </div>
          <label className="field">
            <span>오늘 있었던 일</span>
            <textarea
              name="situation"
              value={value.situation}
              onChange={event => update("situation", event.target.value)}
              maxLength={500}
              required
              aria-describedby={situationHelpId}
              disabled={isLoading}
              placeholder="예: 처음 가는 유치원 앞에서 제 손을 꼭 잡았어요."
            />
          </label>
          <p id={situationHelpId} className="field-help">
            한두 문장으로 편하게 적어주세요. {value.situation.length}/500자
          </p>
          <label className="field mt-5">
            <span>전하고 싶은 마음</span>
            <input
              name="lesson"
              value={value.lesson}
              onChange={event => update("lesson", event.target.value)}
              maxLength={200}
              required
              disabled={isLoading}
              placeholder="예: 천천히 해도 괜찮다는 마음"
            />
          </label>
          <div
            className="lesson-suggestions"
            aria-label="전하고 싶은 마음 추천"
          >
            {[
              "천천히 해도 괜찮아",
              "네 마음도 소중해",
              "함께하면 할 수 있어",
            ].map(message => (
              <button
                key={message}
                type="button"
                disabled={isLoading}
                aria-pressed={value.lesson === message}
                onClick={() => update("lesson", message)}
              >
                {message}
              </button>
            ))}
          </div>
        </section>
      )}
      <details className="form-section creation-preferences">
        <summary>
          이야기 취향 더하기 <span>선택 · 기본은 차분하고 포근하게</span>
        </summary>
        <div className="creation-preferences-content">
          <fieldset>
            <legend className="mb-3 text-[15px]">이야기 분위기</legend>
            <div className="tone-options">
              {tones.map(tone => (
                <button
                  type="button"
                  key={tone.value}
                  aria-pressed={value.tone === tone.value}
                  disabled={isLoading}
                  onClick={() => update("tone", tone.value)}
                >
                  {tone.label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="field mt-6">
            <span>
              좋아하는 것 <small>(선택)</small>
            </span>
            <input
              name="interests"
              value={value.interests || ""}
              onChange={event => update("interests", event.target.value)}
              maxLength={100}
              disabled={isLoading}
              placeholder="예: 토끼 인형, 공룡, 별"
            />
          </label>
        </div>
      </details>
      <div className="form-summary">
        <span>8쪽 그림책 1권 · 곶감 {picturebookCost}개</span>
        <span>{balanceLabel}</span>
      </div>
      <button
        type="submit"
        className="button-primary w-full"
        disabled={!isAuthReady || isLoading || !!invalid}
        aria-describedby={submitHelpId}
      >
        {submitLabel}
      </button>
      <p
        id={submitHelpId}
        className="field-help text-center"
        aria-live="polite"
      >
        {invalid ||
          "결말 선택에 추가 곶감은 들지 않아요. 그림은 글보다 늦게 완성될 수 있어요."}
      </p>
    </form>
  );
}

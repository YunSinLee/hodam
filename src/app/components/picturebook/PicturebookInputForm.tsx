import { useId } from "react";

import type { PicturebookInput, PicturebookTone } from "@/app/types/openai";
import {
  situationExamples,
  validatePicturebookInput,
} from "@/app/utils/picturebook";

interface PicturebookInputFormProps {
  value: PicturebookInput;
  picturebookCost: number;
  beadCount?: number;
  isLoading: boolean;
  isSignedIn?: boolean;
  isAuthReady?: boolean;
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
  onChange,
  onSubmit,
}: PicturebookInputFormProps) {
  const formId = useId();
  const submitHelpId = `${formId}-submit-help`;
  const identityHelpId = `${formId}-identity-help`;
  const situationHelpId = `${formId}-situation-help`;
  const invalid = validatePicturebookInput(value);
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
    submitLabel = isSignedIn
      ? "오늘 밤 그림책 만들기"
      : "로그인하고 그림책 만들기";
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
        <h1>어떤 하루를 보냈나요?</h1>
        <p>
          작은 순간을 들려주세요.
          <br />
          아이의 마음을 담은 8쪽 잠자리 그림책을 만들어요.
        </p>
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
      <section className="form-section">
        <h2>
          <span>02</span>오늘의 작은 순간
        </h2>
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
      </section>
      <section className="form-section">
        <h2>
          <span>03</span>우리 아이가 좋아할 이야기
        </h2>
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
      </section>
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

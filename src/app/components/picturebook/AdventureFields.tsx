import type {
  PicturebookAdventure,
  PicturebookInput,
} from "@/app/types/openai";
import {
  adventureCompanions,
  adventureWorlds,
  heroStyles,
} from "@/lib/picturebook/adventure";

export default function AdventureFields({
  value,
  disabled,
  onChange,
}: {
  value: PicturebookInput & { adventure: PicturebookAdventure };
  disabled: boolean;
  onChange: (value: PicturebookInput) => void;
}) {
  const { adventure } = value;
  function update(next: Partial<PicturebookAdventure>) {
    onChange({ ...value, adventure: { ...adventure, ...next } });
  }
  const world = adventureWorlds[adventure.world];
  return (
    <section className="form-section adventure-fields">
      <h2>
        <span>02</span>오늘은 어디로 떠날까요?
      </h2>
      <fieldset>
        <legend className="sr-only">모험의 장소</legend>
        <div className="adventure-worlds">
          {Object.entries(adventureWorlds).map(([key, place]) => (
            <button
              key={key}
              type="button"
              disabled={disabled}
              aria-pressed={adventure.world === key}
              onClick={() =>
                update({ world: key as PicturebookAdventure["world"] })
              }
            >
              <span className="adventure-symbol" aria-hidden="true">
                {place.symbol}
              </span>
              <strong>{place.label}</strong>
              <span>{place.invitation}</span>
              <span className="adventure-selected" aria-hidden="true">
                {adventure.world === key ? "선택됨 ✓" : "이곳으로 →"}
              </span>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-8">
        <legend className="mb-3 font-medium">함께 갈 단짝</legend>
        <div className="tone-options">
          {Object.entries(adventureCompanions).map(([key, friend]) => (
            <button
              key={key}
              type="button"
              disabled={disabled}
              aria-pressed={adventure.companion === key}
              onClick={() =>
                update({
                  companion: key as PicturebookAdventure["companion"],
                  companionName: friend.name,
                })
              }
            >
              {friend.label}
            </button>
          ))}
        </div>
        <p className="field-help">
          {adventureCompanions[adventure.companion].personality}
        </p>
      </fieldset>
      <div className="field-row mt-5">
        <label className="field">
          <span>단짝 이름</span>
          <input
            name="companionName"
            value={adventure.companionName}
            maxLength={20}
            required
            autoComplete="off"
            disabled={disabled}
            onChange={event => update({ companionName: event.target.value })}
          />
        </label>
        <label className="field">
          <span>그림 속 주인공 모습</span>
          <select
            value={adventure.heroStyle}
            disabled={disabled}
            onChange={event =>
              update({
                heroStyle: event.target
                  .value as PicturebookAdventure["heroStyle"],
              })
            }
          >
            {Object.entries(heroStyles).map(([key, style]) => (
              <option key={key} value={key}>
                {style.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="field-help">
        초록 멜빵바지를 입은 상상 속 주인공이에요. 다음 모험에도 같은 모습의
        단짝과 함께해요.
      </p>
      <div className="adventure-invitation" key={adventure.world}>
        <p className="eyebrow">이번 이야기의 출발점</p>
        <p>
          <strong>{world.label}</strong>에서 {world.invitation}.
        </p>
        <p className="field-help">
          어떻게 해볼지는 이야기 중간에 아이가 골라요.
        </p>
      </div>
      <label className="field mt-5">
        <span>
          모험에 더하고 싶은 것 <small>(선택)</small>
        </span>
        <textarea
          name="situation"
          value={value.situation}
          maxLength={500}
          disabled={disabled}
          placeholder="예: 분홍색 구름을 타보고 싶대요."
          onChange={event =>
            onChange({ ...value, situation: event.target.value })
          }
        />
      </label>
    </section>
  );
}

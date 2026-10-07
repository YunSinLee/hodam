import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultAdventure,
  nextAdventureInput,
  parseAdventure,
  prepareAdventureStarter,
  consumeAdventureStarter,
  adventureCast,
} from "../src/lib/picturebook/adventure";
import {
  validatePicturebookInput,
  parsePicturebookDraft,
} from "../src/app/utils/picturebook";
import { book, input } from "./fixtures";

afterEach(() => {
  consumeAdventureStarter(undefined);
  vi.useRealTimers();
});
describe("adventure book contract", () => {
  it("allows curiosity without a lesson, while retaining daily input requirements", () => {
    const minimal = { ...input, situation: "", lesson: "" };
    expect(validatePicturebookInput(minimal)).toBeTruthy();
    expect(
      validatePicturebookInput({ ...minimal, adventure: defaultAdventure }),
    ).toBeNull();
    expect(
      validatePicturebookInput({
        ...minimal,
        adventure: { ...defaultAdventure, companionName: input.childName },
      }),
    ).toContain("다르게");
  });
  it.each([
    null,
    {},
    [],
    "rabbit",
    { ...defaultAdventure, world: ["moon-bakery"] },
    { ...defaultAdventure, companion: ["rabbit"] },
    { ...defaultAdventure, heroStyle: ["short"] },
    { ...defaultAdventure, world: "__proto__" },
    { ...defaultAdventure, companion: "constructor" },
    { ...defaultAdventure, heroStyle: "unlisted" },
    { ...defaultAdventure, companionName: " " },
    { ...defaultAdventure, companionName: "a".repeat(21) },
    { ...defaultAdventure, companionName: "두\n부" },
  ])("rejects invalid or unbounded adventure metadata %j", value => {
    expect(parseAdventure(value)).toBeNull();
    expect(
      validatePicturebookInput({ ...input, adventure: value }),
    ).toBeTruthy();
    expect(
      parsePicturebookDraft(JSON.stringify({ ...book(), adventure: value })),
    ).toBeNull();
  });
  it("round trips a saved adventure and keeps legacy books readable", () => {
    for (const saved of [
      book(),
      { ...book("complete"), adventure: defaultAdventure },
    ])
      expect(parsePicturebookDraft(JSON.stringify(saved))).toEqual(saved);
    expect(
      parsePicturebookDraft(
        JSON.stringify({
          ...book(),
          adventure: defaultAdventure,
          childAge: undefined,
        }),
      ),
    ).toBeNull();
  });
  it("keeps child and companion identity, while clearing the last event and proposing another world", () => {
    const saved = {
      ...book("complete"),
      adventure: {
        ...defaultAdventure,
        companionName: "달콩",
        heroStyle: "curly" as const,
      },
    };
    const next = nextAdventureInput(saved)!;
    expect(next.childName).toBe(saved.childName);
    expect(next.childAge).toBe(input.childAge);
    expect(next.adventure).toEqual({
      ...saved.adventure,
      world: "dinosaur-post",
    });
    expect(next.situation).toBe("");
    expect(next.lesson).toBe("");
    expect(adventureCast(next.adventure!)).toBe(adventureCast(saved.adventure));
    next.adventure!.companionName = "다른 이름";
    expect(saved.adventure.companionName).toBe("달콩");
    expect(nextAdventureInput({ ...saved, status: "choice-ready" })).toBeNull();
    expect(nextAdventureInput(book("complete"))).toBeNull();
  });
  it("hands off once to the same account and expires without persisting private input", () => {
    const saved = { ...book("complete"), adventure: defaultAdventure };
    expect(prepareAdventureStarter(saved, "owner-a")).toBe(true);
    expect(consumeAdventureStarter("owner-b")).toBeNull();
    expect(consumeAdventureStarter("owner-a")).toBeNull();
    prepareAdventureStarter(saved, "owner-a");
    expect(consumeAdventureStarter("owner-a")?.adventure?.companionName).toBe(
      "두부",
    );
    expect(consumeAdventureStarter("owner-a")).toBeNull();
    vi.useFakeTimers();
    prepareAdventureStarter(saved, "owner-a");
    vi.advanceTimersByTime(15 * 60 * 1000);
    expect(consumeAdventureStarter("owner-a")).toBeNull();
  });
});

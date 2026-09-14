import { describe, expect, it } from "vitest";

import { book } from "./fixtures";
import {
  parsePicturebookDraft,
  parsePicturebookStoryGuide,
} from "../src/app/utils/picturebook";

import type { PicturebookStoryGuide } from "../src/app/types/openai";

const guide: PicturebookStoryGuide = {
  coreConflict: "별이는 불을 끄면 혼자 잠들기 어려워해요.",
  characters: ["별이: 노란 잠옷을 입은 여섯 살 아이", "흰 토끼 인형"],
  keyObject: "흰 토끼 인형",
  resolutionGoal: "토끼를 안고 작은 별빛을 보며 누워 있어요.",
  visualStyle: "부드러운 수채화. 별이는 모든 장면에서 노란 잠옷을 입어요.",
};

describe("picturebook story guide persistence", () => {
  it.each(["choice-ready", "complete"] as const)(
    "keeps existing %s books without a story guide readable",
    status => {
      const existing = book(status);
      expect(parsePicturebookDraft(JSON.stringify(existing))).toEqual(existing);
    },
  );

  it("preserves Korean story and visual context through a saved-book round trip", () => {
    const saved = { ...book(), storyGuide: guide };
    expect(parsePicturebookDraft(JSON.stringify(saved))).toEqual(saved);
    expect(parsePicturebookStoryGuide(guide)).toEqual(guide);
  });

  it.each([null, [], "guide", 42, {}, { ...guide, characters: "별이" }])(
    "rejects malformed guide %s without accepting a partially usable saved book",
    invalid => {
      expect(parsePicturebookStoryGuide(invalid)).toBeNull();
      expect(
        parsePicturebookDraft(
          JSON.stringify({ ...book(), storyGuide: invalid }),
        ),
      ).toBeNull();
    },
  );

  it.each([
    ["coreConflict", 600],
    ["keyObject", 200],
    ["resolutionGoal", 600],
    ["visualStyle", 1200],
  ] as const)(
    "enforces the %s text boundary of %s characters",
    (field, limit) => {
      for (const value of [undefined, "", "   ", 42, "가".repeat(limit + 1)]) {
        const invalid = { ...guide, [field]: value };
        expect(parsePicturebookStoryGuide(invalid)).toBeNull();
        expect(
          parsePicturebookDraft(
            JSON.stringify({ ...book(), storyGuide: invalid }),
          ),
        ).toBeNull();
      }
      for (const value of ["가", "가".repeat(limit)]) {
        expect(
          parsePicturebookStoryGuide({ ...guide, [field]: value }),
        ).toEqual({
          ...guide,
          [field]: value,
        });
      }
    },
  );

  it("bounds the character roster and requires a usable description for each character", () => {
    for (const characters of [
      [],
      Array(7).fill("별이"),
      [""],
      ["   "],
      [42],
      ["가".repeat(101)],
    ]) {
      expect(parsePicturebookStoryGuide({ ...guide, characters })).toBeNull();
    }
    for (const characters of [["별이"], Array(6).fill("가".repeat(100))]) {
      expect(parsePicturebookStoryGuide({ ...guide, characters })).toEqual({
        ...guide,
        characters,
      });
    }
  });
});

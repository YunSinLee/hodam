import { afterEach, describe, expect, it, vi } from "vitest";

import {
  consumeSampleStarter,
  createSampleBook,
  normalizeSampleName,
  prepareSampleStarter,
} from "./sample";

afterEach(() => {
  consumeSampleStarter();
  vi.useRealTimers();
});

describe("free personalized sample", () => {
  it.each([
    ["하준", "하준이의", "하준이는"],
    ["보라", "보라의", "보라는"],
    ["Alex", "Alex의", "Alex는"],
    ["$&", "$&의", "$&는"],
  ])(
    "uses %s literally with the appropriate name suffix",
    (name, possessive, subject) => {
      const book = createSampleBook(name, "C");
      expect(book.childName).toBe(name);
      expect(book.pages[0].textKo).toContain(possessive);
      expect(book.choice.promptKo).toContain(subject);
      expect(book.pages[4].textKo).toContain(subject);
      expect(JSON.stringify(book)).not.toContain("민준");
      expect(createSampleBook().pages[0].textKo).toContain("민준이의");
    },
  );

  it.each(["A", "B", "C"] as const)(
    "keeps all eight pages and choice %s",
    choice => {
      const book = createSampleBook("보라", choice);
      expect(book.status).toBe("complete");
      expect(book.selectedChoiceId).toBe(choice);
      expect(book.pages.map(page => page.pageNumber)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8,
      ]);
      expect(createSampleBook("보라").pages).toHaveLength(4);
      expect(createSampleBook("보라").selectedChoiceId).toBeUndefined();
    },
  );

  it("bounds names and falls back for blank/control-only input", () => {
    expect(normalizeSampleName(" \n\t ")).toBe("민준");
    expect(normalizeSampleName("  보라\u0000  ")).toBe("보라");
    expect(normalizeSampleName("가".repeat(30))).toHaveLength(20);
  });

  it("hands off a nickname and example once, without making up the child's age", () => {
    prepareSampleStarter("보라");
    const starter = consumeSampleStarter();
    expect(starter).toMatchObject({
      childName: "보라",
      situation: expect.stringContaining("유치원"),
    });
    expect(starter).not.toHaveProperty("childAge");
    expect(consumeSampleStarter()).toBeNull();
  });

  it("expires a forgotten handoff after fifteen minutes", () => {
    vi.useFakeTimers();
    prepareSampleStarter("보라");
    vi.advanceTimersByTime(15 * 60_000);
    expect(consumeSampleStarter()).toBeNull();
  });
});

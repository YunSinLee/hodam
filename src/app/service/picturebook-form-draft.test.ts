// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PicturebookInput } from "@/app/types/openai";
import { defaultAdventure } from "@/lib/picturebook/adventure";

import {
  clearFormDraft,
  consumeFormDraftLogin,
  createFormModes,
  prepareFormDraftLogin,
  readFormDraft,
  saveFormDraft,
} from "./picturebook-form-draft";

const guestKey = "hodam-picturebook-form-draft:v1:guest";
const ownerKey = (owner: string) =>
  `hodam-picturebook-form-draft:v1:user:${owner}`;
const loginKey = "hodam-picturebook-form-draft:v1:login";
const input: PicturebookInput = {
  childName: "",
  childAge: "",
  situation: "아직 쓰는 중 ",
  lesson: "",
  tone: "calm",
};
const start = Date.parse("2026-10-08T06:00:00Z");

function saveGuest(value = input) {
  expect(saveFormDraft(undefined, value, createFormModes(value))).toBe(true);
}
interface TamperedEnvelope {
  padding?: unknown;
  draft: {
    savedAt: unknown;
    input: { tone: unknown };
    modes: { adventure: { adventure: { heroStyle: unknown } } };
  };
}

function mutateGuest(update: (envelope: TamperedEnvelope) => void) {
  const envelope: TamperedEnvelope = JSON.parse(
    window.sessionStorage.getItem(guestKey)!,
  );
  update(envelope);
  window.sessionStorage.setItem(guestKey, JSON.stringify(envelope));
}

describe("picturebook form drafts", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(start);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("keeps unfinished input and initializes only the active mode's fields", () => {
    saveGuest();
    expect(readFormDraft(undefined)).toEqual({
      available: true,
      draft: {
        input,
        modes: {
          daily: { situation: input.situation, lesson: "" },
          adventure: { adventure: defaultAdventure, situation: "", lesson: "" },
        },
        savedAt: start,
      },
    });
    const adventureInput = {
      ...input,
      adventure: { ...defaultAdventure, companionName: "" },
    };
    const modes = createFormModes(adventureInput);
    expect(modes).toEqual({
      daily: { situation: "", lesson: "" },
      adventure: {
        adventure: adventureInput.adventure,
        situation: input.situation,
        lesson: "",
      },
    });
    expect(saveFormDraft(undefined, adventureInput, modes)).toBe(true);
    expect(readFormDraft(undefined).draft?.input.adventure?.companionName).toBe(
      "",
    );
    adventureInput.adventure.companionName = "변경";
    expect(modes.adventure.adventure.companionName).toBe("");
  });

  it("preserves both mode buffers and returns independent allowlisted copies", () => {
    const extra = {
      ...input,
      unsafe: "drop",
      adventure: {
        ...defaultAdventure,
        companionName: "",
        characterAppearance: "drop",
      },
    };
    const modes = {
      ...createFormModes(extra),
      daily: { situation: "유치원에서", lesson: "기다리기", unsafe: true },
    };
    expect(saveFormDraft("owner-a", extra, modes)).toBe(true);
    const first = readFormDraft("owner-a").draft!;
    expect(first.input).not.toHaveProperty("unsafe");
    expect(first.input.adventure).not.toHaveProperty("characterAppearance");
    expect(first.modes.daily).toEqual({
      situation: "유치원에서",
      lesson: "기다리기",
    });
    expect(first.modes.adventure.adventure).not.toHaveProperty(
      "characterAppearance",
    );
    first.input.childName = "외부 수정";
    first.modes.adventure.adventure.companionName = "외부 수정";
    const second = readFormDraft("owner-a").draft!;
    expect(second.input.childName).toBe("");
    expect(second.modes.adventure.adventure.companionName).toBe("");
    expect(window.localStorage.length).toBe(0);
  });

  it("isolates guest and account drafts and verifies the embedded owner", () => {
    saveGuest();
    expect(
      saveFormDraft(
        "owner-a",
        { ...input, childName: "계정 초안" },
        createFormModes(input),
      ),
    ).toBe(true);
    expect(readFormDraft("owner-a").draft?.input.childName).toBe("계정 초안");
    expect(readFormDraft(undefined).draft?.input.childName).toBe("");
    expect(readFormDraft("owner-b").draft).toBeNull();
    window.sessionStorage.setItem(
      ownerKey("owner-b"),
      window.sessionStorage.getItem(ownerKey("owner-a"))!,
    );
    expect(readFormDraft("owner-b").draft).toBeNull();
    window.sessionStorage.setItem(
      guestKey,
      window.sessionStorage.getItem(ownerKey("owner-a"))!,
    );
    expect(readFormDraft(undefined).draft).toBeNull();
    expect(saveFormDraft("", input, createFormModes(input))).toBe(false);
  });

  it("expires after two hours and does not extend the expiry when read", () => {
    saveGuest();
    const before = window.sessionStorage.getItem(guestKey);
    vi.advanceTimersByTime(2 * 60 * 60 * 1000 - 1);
    expect(readFormDraft(undefined).draft?.savedAt).toBe(start);
    expect(window.sessionStorage.getItem(guestKey)).toBe(before);
    vi.advanceTimersByTime(1);
    expect(readFormDraft(undefined)).toEqual({ draft: null, available: true });
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, start + 1])(
    "rejects invalid or future savedAt %s",
    savedAt => {
      saveGuest();
      mutateGuest(envelope => {
        Object.assign(envelope.draft, { savedAt });
      });
      expect(readFormDraft(undefined)).toEqual({
        draft: null,
        available: true,
      });
    },
  );

  it("rejects malformed, oversized UTF-8 payloads and invalid enums without confusing them with blocked storage", () => {
    window.sessionStorage.setItem(guestKey, "{");
    expect(readFormDraft(undefined)).toEqual({ draft: null, available: true });
    saveGuest();
    mutateGuest(envelope => {
      Object.assign(envelope, { padding: "가".repeat(6000) });
    });
    expect(window.sessionStorage.getItem(guestKey)!.length).toBeLessThan(
      16 * 1024,
    );
    expect(readFormDraft(undefined).draft).toBeNull();
    saveGuest();
    mutateGuest(envelope => {
      Object.assign(envelope.draft.modes.adventure.adventure, {
        heroStyle: "unknown",
      });
    });
    expect(readFormDraft(undefined).draft).toBeNull();
    saveGuest();
    mutateGuest(envelope => {
      Object.assign(envelope.draft.input, { tone: "unknown" });
    });
    expect(readFormDraft(undefined).draft).toBeNull();
  });

  it("accepts field boundaries and rejects overlong input without replacing an existing draft", () => {
    const maxInput: PicturebookInput = {
      childName: "가".repeat(20),
      childAge: "12",
      situation: "가".repeat(500),
      lesson: "가".repeat(200),
      tone: "playful",
      interests: "가".repeat(100),
      adventure: { ...defaultAdventure, companionName: "가".repeat(20) },
    };
    expect(saveFormDraft(undefined, maxInput, createFormModes(maxInput))).toBe(
      true,
    );
    expect(
      saveFormDraft(
        undefined,
        { ...maxInput, childName: "가".repeat(21) },
        createFormModes(maxInput),
      ),
    ).toBe(false);
    expect(
      saveFormDraft(
        undefined,
        { ...maxInput, childAge: "13" },
        createFormModes(maxInput),
      ),
    ).toBe(false);
    expect(
      saveFormDraft(
        undefined,
        { ...maxInput, situation: "가".repeat(501) },
        createFormModes(maxInput),
      ),
    ).toBe(false);
    expect(readFormDraft(undefined).draft?.input).toEqual(maxInput);
  });

  it("reports blocked storage and failed writes or deletes without throwing", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readFormDraft(undefined)).toEqual({ draft: null, available: false });
    expect(saveFormDraft(undefined, input, createFormModes(input))).toBe(false);
    expect(clearFormDraft(undefined)).toBe(false);
    expect(prepareFormDraftLogin()).toBe(false);
    expect(consumeFormDraftLogin("owner-a")).toEqual({
      draft: null,
      available: false,
    });
  });

  it("never migrates a legacy input automatically or changes pending request storage", () => {
    window.sessionStorage.setItem(
      "hodam-picturebook-input",
      JSON.stringify(input),
    );
    window.sessionStorage.setItem(
      "hodam-picturebook-request:owner-a",
      "pending",
    );
    expect(readFormDraft(undefined).draft).toBeNull();
    expect(prepareFormDraftLogin()).toBe(false);
    saveGuest();
    expect(clearFormDraft(undefined)).toBe(true);
    expect(window.sessionStorage.getItem("hodam-picturebook-input")).toBe(
      JSON.stringify(input),
    );
    expect(
      window.sessionStorage.getItem("hodam-picturebook-request:owner-a"),
    ).toBe("pending");
  });
});

describe("explicit one-use login handoff", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(start);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("does not promote a guest draft merely because somebody signs in", () => {
    saveGuest();
    expect(consumeFormDraftLogin("owner-a")).toEqual({
      draft: null,
      available: true,
    });
    expect(readFormDraft("owner-a").draft).toBeNull();
    expect(readFormDraft(undefined).draft).not.toBeNull();
  });

  it("moves the deliberate snapshot once and preserves the original expiration", () => {
    saveGuest();
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(prepareFormDraftLogin()).toBe(true);
    saveGuest({ ...input, childName: "나중에 바꾼 이름" });
    const result = consumeFormDraftLogin("owner-a");
    expect(result).toMatchObject({
      available: true,
      draft: { input, savedAt: start },
    });
    expect(readFormDraft("owner-a").draft).toEqual(result.draft);
    expect(readFormDraft(undefined).draft).toBeNull();
    expect(window.sessionStorage.getItem(loginKey)).toBeNull();
    expect(consumeFormDraftLogin("owner-a").draft).toBeNull();
    expect(consumeFormDraftLogin("owner-b").draft).toBeNull();
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(readFormDraft("owner-a").draft).toBeNull();
  });

  it("does not consume an expired or malformed marker", () => {
    saveGuest();
    expect(prepareFormDraftLogin()).toBe(true);
    vi.advanceTimersByTime(2 * 60 * 60 * 1000);
    expect(consumeFormDraftLogin("owner-a")).toEqual({
      draft: null,
      available: true,
    });
    window.sessionStorage.setItem(loginKey, "{}");
    expect(consumeFormDraftLogin("owner-a")).toEqual({
      draft: null,
      available: true,
    });
  });

  it("clears the linked handoff when the guest explicitly discards the draft", () => {
    saveGuest();
    expect(prepareFormDraftLogin()).toBe(true);
    expect(clearFormDraft(undefined)).toBe(true);
    expect(consumeFormDraftLogin("owner-a").draft).toBeNull();
    expect(readFormDraft(undefined).draft).toBeNull();
  });

  it("binds a partly failed handoff to the first account and supports only that account retrying", () => {
    saveGuest();
    expect(prepareFormDraftLogin()).toBe(true);
    const originalRemove = Storage.prototype.removeItem;
    const remove = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(function removeItem(this: Storage, key: string) {
        if (key === guestKey) throw new Error("temporary delete failure");
        return originalRemove.call(this, key);
      });
    expect(consumeFormDraftLogin("owner-a")).toEqual({
      draft: null,
      available: false,
    });
    expect(consumeFormDraftLogin("owner-b")).toEqual({
      draft: null,
      available: true,
    });
    expect(readFormDraft("owner-b").draft).toBeNull();
    remove.mockRestore();
    expect(consumeFormDraftLogin("owner-a")).toMatchObject({
      available: true,
      draft: { input },
    });
    expect(consumeFormDraftLogin("owner-a").draft).toBeNull();
  });

  it("does not revive a discarded owner draft through a partly completed handoff", () => {
    saveGuest();
    expect(prepareFormDraftLogin()).toBe(true);
    const originalRemove = Storage.prototype.removeItem;
    const remove = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(function removeItem(this: Storage, key: string) {
        if (key === guestKey) throw new Error("temporary delete failure");
        return originalRemove.call(this, key);
      });
    expect(consumeFormDraftLogin("owner-a")).toEqual({
      draft: null,
      available: false,
    });
    remove.mockRestore();
    expect(readFormDraft("owner-a").draft).not.toBeNull();
    expect(clearFormDraft("owner-a")).toBe(true);
    expect(consumeFormDraftLogin("owner-a").draft).toBeNull();
    expect(readFormDraft("owner-a").draft).toBeNull();
  });

  it.each([null, "owner-b"])(
    "keeps a handoff bound to %s when a different owner discards their own draft",
    boundOwner => {
      saveGuest();
      expect(prepareFormDraftLogin()).toBe(true);
      const marker = JSON.parse(window.sessionStorage.getItem(loginKey)!);
      window.sessionStorage.setItem(
        loginKey,
        JSON.stringify({ ...marker, boundOwner }),
      );
      expect(clearFormDraft("owner-a")).toBe(true);
      expect(consumeFormDraftLogin("owner-b").draft).not.toBeNull();
    },
  );
});

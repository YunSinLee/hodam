import { describe, expect, it } from "vitest";

import {
  validPackage,
  validPaymentInput,
} from "../src/app/utils/bead-packages";
import { safeReturnPath } from "../src/app/utils/navigation";
import {
  parsePicturebookDraft,
  spreadStart,
  validatePicturebookInput,
} from "../src/app/utils/picturebook";

import { book, input } from "./fixtures";

describe("user input and saved books", () => {
  it("accepts a real picturebook and its completed ending", () => {
    expect(validatePicturebookInput(input)).toBeNull();
    expect(parsePicturebookDraft(JSON.stringify(book()))?.pages).toHaveLength(
      4,
    );
    expect(
      parsePicturebookDraft(JSON.stringify(book("complete")))?.pages,
    ).toHaveLength(8);
  });
  it.each(["-1", "0", "2", "13", "5살", "5abc", "1.5", ""])(
    "rejects invalid age %s",
    childAge => {
      expect(validatePicturebookInput({ ...input, childAge })).not.toBeNull();
    },
  );
  it("rejects blank and oversized parent inputs", () => {
    expect(
      validatePicturebookInput({ ...input, childName: "   " }),
    ).not.toBeNull();
    expect(
      validatePicturebookInput({ ...input, situation: "가".repeat(501) }),
    ).not.toBeNull();
    expect(
      validatePicturebookInput({ ...input, interests: 123 }),
    ).not.toBeNull();
  });
  it.each([
    "bad JSON",
    "null",
    '{"kind":"picturebook","title":"test","pages":[]}',
  ])("rejects malformed persisted book %s without throwing", value =>
    expect(parsePicturebookDraft(value)).toBeNull(),
  );
  it("rejects missing choices and non-sequential pages before the reader can crash", () => {
    expect(
      parsePicturebookDraft(JSON.stringify({ ...book(), choice: null })),
    ).toBeNull();
    const invalid = book();
    invalid.pages[3].pageNumber = 1;
    expect(parsePicturebookDraft(JSON.stringify(invalid))).toBeNull();
  });
  it("keeps the last mobile page visible when switching to a two-page spread", () => {
    expect(spreadStart(7, true, 8)).toBe(6);
    expect(spreadStart(3, true, 4)).toBe(2);
    expect(spreadStart(99, false, 4)).toBe(3);
  });
});
describe("safe login return paths", () => {
  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/sign-in",
    "/auth/callback",
    "/\nevil",
    undefined,
  ])("rejects external or looping path %s", path =>
    expect(safeReturnPath(path)).toBe("/service"),
  );
  it("preserves the selected story including its query", () =>
    expect(safeReturnPath("/my-story/42?from=book")).toBe(
      "/my-story/42?from=book",
    ));
});
describe("payment input", () => {
  it("does not accept a manipulated package price or quantity", () => {
    expect(validPackage(5, 2500)).toBe(true);
    expect(validPackage(100, 2500)).toBe(false);
    expect(validPackage("5", 2500)).toBe(false);
  });
  it.each([0, -10, 0.5, "2500", null, Infinity])(
    "rejects invalid payment amount %s",
    amount =>
      expect(
        validPaymentInput({ paymentKey: "key", orderId: "order", amount }),
      ).toBe(false),
  );
});

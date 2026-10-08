import { readFileSync } from "node:fs";

import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { createPicturebookPdf, downloadPicturebookPdf } from "./pdf";
import { createSampleBook } from "./sample";

const fontBytes = new Uint8Array(
  readFileSync("public/fonts/NanumGothic-Regular.ttf"),
);

describe("picturebook PDF", () => {
  it("embeds a Korean font and creates a cover plus all text pages", async () => {
    const book = createSampleBook("하늘", "B");
    const bytes = await createPicturebookPdf({
      picturebook: book,
      fontBytes,
      illustrated: false,
    });
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(9);
    expect(document.getTitle()).toBe(book.title);
    expect(document.getAuthor()).toBe("호담 HODAM");
    expect(bytes.length).toBeGreaterThan(5000);
  });

  it("creates continuation pages for unusually long existing stories", async () => {
    const book = createSampleBook("하늘", "A");
    book.pages[0].textKo =
      "호랑이는 하늘이와 함께 작은 길을 걸어갔어요. ".repeat(35);
    const bytes = await createPicturebookPdf({
      picturebook: book,
      fontBytes,
      illustrated: false,
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(9);
  });

  it("refuses a silently incomplete illustrated PDF", async () => {
    await expect(
      createPicturebookPdf({
        picturebook: createSampleBook("하늘", "A"),
        fontBytes,
      }),
    ).rejects.toMatchObject({
      code: "images",
      pages: [1, 2, 3, 4, 5, 6, 7, 8],
    });
    await expect(
      downloadPicturebookPdf({
        picturebook: createSampleBook("하늘", "A"),
        imageUrls: {},
      }),
    ).rejects.toMatchObject({ code: "images" });
  });

  it("does not export an unfinished story or replace unsupported names with squares", async () => {
    await expect(
      createPicturebookPdf({
        picturebook: createSampleBook(),
        fontBytes,
        illustrated: false,
      }),
    ).rejects.toMatchObject({ code: "incomplete" });
    await expect(
      createPicturebookPdf({
        picturebook: createSampleBook("하늘🦊", "A"),
        fontBytes,
        illustrated: false,
      }),
    ).rejects.toMatchObject({ code: "text" });
  });
});

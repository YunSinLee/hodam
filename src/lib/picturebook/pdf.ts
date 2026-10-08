import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";

import type { PicturebookDraft } from "@/app/types/openai";

import {
  paginatePdfLines,
  picturebookPdfFilename,
  wrapPdfText,
} from "./pdf-layout";

import type { PDFFont, PDFImage, PDFPage } from "pdf-lib";

export interface PdfImageData {
  bytes: Uint8Array;
  format: "png" | "jpg";
}

export interface PicturebookPdfOptions {
  picturebook: PicturebookDraft;
  imageUrls: Record<number, string | null | undefined>;
  imageUrl?: string | null;
  illustrated?: boolean;
  signal?: AbortSignal;
}

export class PicturebookPdfError extends Error {
  constructor(
    public readonly code: "images" | "font" | "text" | "incomplete",
    message: string,
    public readonly pages: number[] = [],
  ) {
    super(message);
    this.name = "PicturebookPdfError";
  }
}

const WIDTH = 419.53;
const HEIGHT = 595.28;
const MARGIN = 32;
const BODY_SIZE = 15;
const LINE_HEIGHT = 24;
const PAPER = rgb(1, 0.988, 0.961);
const INK = rgb(0.2, 0.25, 0.22);
const SAGE = rgb(0.34, 0.44, 0.36);
const MUTED = rgb(0.43, 0.46, 0.41);

function drawLines(
  page: PDFPage,
  lines: string[],
  font: PDFFont,
  x: number,
  y: number,
  size: number,
  lineHeight: number,
) {
  lines.forEach((line, index) => {
    if (line)
      page.drawText(line, {
        x,
        y: y - index * lineHeight,
        size,
        font,
        color: INK,
      });
  });
}

function drawImageWithin(
  page: PDFPage,
  image: PDFImage,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scaled = image.scaleToFit(width, height);
  page.drawImage(image, {
    x: x + (width - scaled.width) / 2,
    y: y + (height - scaled.height) / 2,
    width: scaled.width,
    height: scaled.height,
  });
}

/** Pure document builder. Image data is local; URLs never enter the PDF. */
export async function createPicturebookPdf({
  picturebook,
  fontBytes,
  images = {},
  illustrated = true,
}: {
  picturebook: PicturebookDraft;
  fontBytes: Uint8Array;
  images?: Record<number, PdfImageData>;
  illustrated?: boolean;
}): Promise<Uint8Array> {
  if (picturebook.status !== "complete" || picturebook.pages.length === 0) {
    throw new PicturebookPdfError(
      "incomplete",
      "결말까지 완성한 뒤 PDF로 저장할 수 있어요.",
    );
  }
  const missing = picturebook.pages
    .filter(page => !images[page.pageNumber])
    .map(page => page.pageNumber);
  if (illustrated && missing.length) {
    throw new PicturebookPdfError(
      "images",
      "아직 준비되지 않은 그림이 있어요.",
      missing,
    );
  }
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  // This Korean font's composite glyphs do not survive fontkit subsetting in
  // all PDF readers. Embed it intact so printed/exported Hangul stays legible.
  const font = await doc.embedFont(fontBytes);
  const supported = new Set(font.getCharacterSet());
  const texts = [
    picturebook.title,
    picturebook.childName,
    ...picturebook.pages.map(page => page.textKo),
  ];
  if (
    texts.some(text =>
      Array.from(text.normalize("NFC")).some(character => {
        const point = character.codePointAt(0);
        return (
          character !== "\n" &&
          character !== "\r" &&
          point !== undefined &&
          !supported.has(point)
        );
      }),
    )
  ) {
    throw new PicturebookPdfError(
      "text",
      "PDF에서 지원하지 않는 문자가 있어요. 글로 저장하기를 이용해 주세요.",
    );
  }
  doc.setTitle(picturebook.title);
  doc.setAuthor("호담 HODAM");
  doc.setCreator("호담 HODAM");
  doc.setLanguage("ko-KR");
  const embedded = new Map<number, PDFImage>();
  await Promise.all(
    Object.entries(illustrated ? images : {}).map(async ([number, data]) => {
      const image =
        data.format === "jpg"
          ? await doc.embedJpg(data.bytes)
          : await doc.embedPng(data.bytes);
      embedded.set(Number(number), image);
    }),
  );
  const addPage = () => {
    const page = doc.addPage([WIDTH, HEIGHT]);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: WIDTH,
      height: HEIGHT,
      color: PAPER,
    });
    return page;
  };
  const cover = addPage();
  cover.drawText("HODAM", { x: MARGIN, y: 553, size: 11, font, color: SAGE });
  cover.drawLine({
    start: { x: MARGIN, y: 536 },
    end: { x: WIDTH - MARGIN, y: 536 },
    color: SAGE,
    thickness: 0.6,
  });
  const dedication = wrapPdfText(
    `${picturebook.childName}의 마음에 남을 한 권`,
    WIDTH - MARGIN * 2,
    text => font.widthOfTextAtSize(text, 11),
  );
  drawLines(cover, dedication, font, MARGIN, 514, 11, 17);
  const title = wrapPdfText(picturebook.title, WIDTH - MARGIN * 2, text =>
    font.widthOfTextAtSize(text, 25),
  );
  if (title.length > 6 || dedication.length > 2) {
    throw new PicturebookPdfError(
      "text",
      "제목이나 이름이 너무 길어 PDF로 옮기지 못했어요. 글로 저장하기를 이용해 주세요.",
    );
  }
  const titleY = 475 - (dedication.length - 1) * 17;
  drawLines(cover, title, font, MARGIN, titleY, 25, 36);
  const imageTop = titleY - title.length * 36 - 12;
  const coverImage = embedded.get(picturebook.pages[0].pageNumber);
  if (coverImage) {
    drawImageWithin(
      cover,
      coverImage,
      MARGIN,
      74,
      WIDTH - MARGIN * 2,
      imageTop - 74,
    );
  } else {
    cover.drawText("함께 읽고, 오래 간직하는 이야기", {
      x: MARGIN,
      y: 248,
      size: 13,
      font,
      color: MUTED,
    });
  }
  cover.drawText(
    illustrated ? "우리만의 그림책" : "글로 간직하는 그림책 · 그림 미포함",
    { x: MARGIN, y: 40, size: 9, font, color: MUTED },
  );

  picturebook.pages.forEach(storyPage => {
    const lines = wrapPdfText(storyPage.textKo, WIDTH - MARGIN * 2, text =>
      font.widthOfTextAtSize(text, BODY_SIZE),
    );
    const chunks = paginatePdfLines(lines, illustrated ? 6 : 18, 18);
    chunks.forEach((chunk, index) => {
      const page = addPage();
      page.drawText(
        index
          ? `${storyPage.pageNumber}쪽 · 이어지는 글`
          : `${storyPage.pageNumber}쪽`,
        { x: MARGIN, y: 555, size: 10, font, color: SAGE },
      );
      const image =
        index === 0 ? embedded.get(storyPage.pageNumber) : undefined;
      if (image)
        drawImageWithin(page, image, MARGIN, 217, WIDTH - MARGIN * 2, 312);
      drawLines(
        page,
        chunk,
        font,
        MARGIN,
        image ? 189 : 510,
        BODY_SIZE,
        LINE_HEIGHT,
      );
      const pageLabel = `${storyPage.pageNumber} / ${picturebook.pages.length}`;
      page.drawText(pageLabel, {
        x: (WIDTH - font.widthOfTextAtSize(pageLabel, 9)) / 2,
        y: 29,
        size: 9,
        font,
        color: MUTED,
      });
    });
  });
  return doc.save();
}

async function fetchBytes(
  url: string,
  signal?: AbortSignal,
): Promise<{ bytes: Uint8Array; type: string }> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 20_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok) throw new Error("PDF asset unavailable.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > 20 * 1024 * 1024)
      throw new Error("PDF asset too large.");
    return {
      bytes,
      type: response.headers.get("content-type") || "application/octet-stream",
    };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

async function imageData(
  bytes: Uint8Array,
  type: string,
): Promise<PdfImageData> {
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const isWebp =
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (!isPng && !isJpeg && !isWebp) throw new Error("Unsupported PDF image.");
  // Decode and compress locally. Eight lossless images would create a very
  // large download on mobile; 1280 px remains crisp at this A5 print size.
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 16_777_216
    )
      throw new Error("Invalid PDF image.");
    const canvas = document.createElement("canvas");
    const scale = Math.min(
      1,
      1280 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image conversion unavailable.");
    context.fillStyle = "#fffcf5";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const compressed = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        blob =>
          blob ? resolve(blob) : reject(new Error("Image conversion failed.")),
        "image/jpeg",
        0.92,
      );
    });
    return {
      bytes: new Uint8Array(await compressed.arrayBuffer()),
      format: "jpg",
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function downloadPicturebookPdf({
  picturebook,
  imageUrls,
  imageUrl,
  illustrated = true,
  signal,
}: PicturebookPdfOptions): Promise<void> {
  const images: Record<number, PdfImageData> = {};
  if (illustrated) {
    const missing = picturebook.pages
      .filter(
        page =>
          !(imageUrls[page.pageNumber] || (page.pageNumber === 1 && imageUrl)),
      )
      .map(page => page.pageNumber);
    if (missing.length)
      throw new PicturebookPdfError(
        "images",
        "아직 준비되지 않은 그림이 있어요.",
        missing,
      );
    // Sequential loading avoids several decoded full-size images on mobile at once.
    await picturebook.pages.reduce(async (previous, page) => {
      await previous;
      signal?.throwIfAborted();
      const url = imageUrls[page.pageNumber] || imageUrl;
      try {
        if (!url) throw new Error("Missing image.");
        const asset = await fetchBytes(url, signal);
        images[page.pageNumber] = await imageData(asset.bytes, asset.type);
      } catch (error) {
        if (signal?.aborted) throw error;
        throw new PicturebookPdfError(
          "images",
          "그림을 불러오지 못했어요. 다시 시도하거나 글만 저장할 수 있어요.",
          [page.pageNumber],
        );
      }
    }, Promise.resolve());
  }
  let fontBytes: Uint8Array;
  try {
    fontBytes = (await fetchBytes("/fonts/NanumGothic-Regular.ttf", signal))
      .bytes;
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new PicturebookPdfError(
      "font",
      "한글 글꼴을 불러오지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.",
    );
  }
  signal?.throwIfAborted();
  const bytes = await createPicturebookPdf({
    picturebook,
    fontBytes,
    images,
    illustrated,
  });
  signal?.throwIfAborted();
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = picturebookPdfFilename(picturebook.title, illustrated);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Safari may consume the blob after the click callback has finished.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

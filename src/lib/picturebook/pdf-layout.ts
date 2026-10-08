/** Wrap by measured width, including Korean words with no spaces. */
export function wrapPdfText(
  text: string,
  maxWidth: number,
  measure: (text: string) => number,
): string[] {
  const lines: string[] = [];
  text
    .normalize("NFC")
    .split(/\r?\n/)
    .forEach(paragraph => {
      let line = "";
      Array.from(paragraph.replace(/\s+/g, " ").trim()).forEach(character => {
        const candidate = line + character;
        if (line && measure(candidate) > maxWidth) {
          const wordBoundary = line.lastIndexOf(" ");
          if (wordBoundary > 0 && character !== " ") {
            lines.push(line.slice(0, wordBoundary));
            line = line.slice(wordBoundary + 1) + character;
          } else {
            lines.push(line.trimEnd());
            line = character.trimStart();
          }
        } else {
          line = candidate;
        }
      });
      lines.push(line.trimEnd());
    });
  return lines;
}

export function paginatePdfLines(
  lines: string[],
  firstPageCapacity: number,
  continuationCapacity: number,
): string[][] {
  if (firstPageCapacity < 1 || continuationCapacity < 1) {
    throw new Error("PDF page capacity must be positive.");
  }
  const pages = [lines.slice(0, firstPageCapacity)];
  for (
    let index = firstPageCapacity;
    index < lines.length;
    index += continuationCapacity
  ) {
    pages.push(lines.slice(index, index + continuationCapacity));
  }
  return pages;
}

export function picturebookPdfFilename(
  title: string,
  illustrated: boolean,
): string {
  const safeTitle =
    title
      .normalize("NFC")
      // File names must not contain controls or platform path separators.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, "")
      .trim()
      .slice(0, 70)
      .replace(/[. ]+$/, "") || "호담 그림책";
  return `${safeTitle}${illustrated ? "" : " (글만)"}.pdf`;
}

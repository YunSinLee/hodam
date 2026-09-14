// @vitest-environment jsdom
import { createElement } from "react";

import { notFound } from "next/navigation";

import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import PublicStoryPage, {
  generateMetadata,
  generateStaticParams,
} from "@/app/bedtime-stories/[slug]/page";
import BedtimeStoriesPage from "@/app/bedtime-stories/page";
import * as storyContent from "@/content/public-stories";
import { SITE_URL } from "@/lib/seo";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

const { PUBLIC_STORIES } = storyContent;

async function renderStory(slug: string) {
  const page = await PublicStoryPage({ params: Promise.resolve({ slug }) });
  const html = renderToStaticMarkup(page);
  return new DOMParser().parseFromString(html, "text/html");
}

function readArticleData(document: Document) {
  const scripts = document.querySelectorAll(
    'script[type="application/ld+json"]',
  );
  expect(scripts).toHaveLength(1);
  return JSON.parse(scripts[0].textContent ?? "") as {
    "@type": string;
    headline: string;
    articleBody: string;
    mainEntityOfPage: string;
    image: string;
    inLanguage: string;
  };
}

describe("public bedtime stories without client JavaScript", () => {
  it.each(PUBLIC_STORIES)(
    "server-renders all eight passages of $slug in reading order",
    async story => {
      const document = await renderStory(story.slug);
      const article = document.querySelector("article");
      expect(article).not.toBeNull();
      expect(document.querySelectorAll("h1")).toHaveLength(1);
      expect(article?.querySelector("h1")?.textContent).toBe(story.title);

      const expectedPassages = story.pages.map(page => page.text);
      expect(expectedPassages).toHaveLength(8);
      const paragraphs = Array.from(article!.querySelectorAll("p"));
      const renderedPassages = paragraphs.filter(paragraph =>
        expectedPassages.includes(paragraph.textContent ?? ""),
      );
      expect(renderedPassages.map(paragraph => paragraph.textContent)).toEqual(
        expectedPassages,
      );
      renderedPassages.forEach(paragraph => {
        expect(
          paragraph.closest('script, [hidden], [aria-hidden="true"]'),
        ).toBeNull();
      });

      expect(article?.querySelector("img")?.getAttribute("alt")).toBe(
        story.image.alt,
      );
      expect(document.querySelector('a[href="/service"]')?.textContent).toMatch(
        /그림책 만들기/,
      );
      expect(
        document.querySelector('a[href="/bedtime-stories"]')?.textContent,
      ).toMatch(/동화 모음/);
    },
  );

  it("provides crawlable, named links to every public story from the library", () => {
    const html = renderToStaticMarkup(createElement(BedtimeStoriesPage));
    const document = new DOMParser().parseFromString(html, "text/html");
    const storyLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(
        'a[href^="/bedtime-stories/"]',
      ),
    );
    const destinations = Array.from(
      new Set(storyLinks.map(link => link.pathname)),
    );

    expect(destinations).toHaveLength(3);
    expect(destinations.sort()).toEqual(
      PUBLIC_STORIES.map(story => `/bedtime-stories/${story.slug}`).sort(),
    );
    PUBLIC_STORIES.forEach(story => {
      const titleLink = storyLinks.find(
        link =>
          link.pathname === `/bedtime-stories/${story.slug}` &&
          link.textContent?.trim() === story.title,
      );
      expect(titleLink).toBeDefined();
      const coverLink = storyLinks.find(
        link =>
          link.pathname === `/bedtime-stories/${story.slug}` &&
          link.querySelector("img"),
      );
      expect(coverLink?.getAttribute("aria-label")).toContain(story.title);
      expect(coverLink?.querySelector("img")?.getAttribute("alt")).toBeTruthy();
    });
  });

  it("returns a not-found response for a slug outside the public collection", async () => {
    await expect(
      PublicStoryPage({
        params: Promise.resolve({ slug: "a-private-or-missing-story" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("includes every readable story in static route generation", () => {
    expect(generateStaticParams()).toEqual(
      PUBLIC_STORIES.map(story => ({ slug: story.slug })),
    );
  });
});

describe("public story search metadata", () => {
  it.each(PUBLIC_STORIES)(
    "gives $slug its own canonical URL and share image",
    async story => {
      const metadata = await generateMetadata({
        params: Promise.resolve({ slug: story.slug }),
      });
      const pageUrl = `${SITE_URL}/bedtime-stories/${story.slug}`;

      expect(metadata.alternates?.canonical).toBe(pageUrl);
      expect(metadata.openGraph?.url).toBe(pageUrl);
      expect(metadata.openGraph?.images).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ url: `${SITE_URL}${story.image.src}` }),
        ]),
      );
      expect(metadata.description).toBe(story.description);
      expect(metadata.robots).toEqual(
        expect.objectContaining({ index: true, follow: true }),
      );
    },
  );

  it.each(PUBLIC_STORIES)(
    "exposes a parseable Article with the full readable text for $slug",
    async story => {
      const articleData = readArticleData(await renderStory(story.slug));

      expect(articleData["@type"]).toBe("Article");
      expect(articleData.headline).toBe(story.title);
      expect(articleData.inLanguage).toBe("ko-KR");
      expect(articleData.mainEntityOfPage).toBe(
        `${SITE_URL}/bedtime-stories/${story.slug}`,
      );
      expect(articleData.image).toBe(`${SITE_URL}${story.image.src}`);
      expect(articleData.articleBody.split("\n\n")).toEqual(
        story.pages.map(page => page.text),
      );
    },
  );

  it("keeps HTML-like editorial text inside JSON-LD and visible text nodes", async () => {
    const story = PUBLIC_STORIES[0];
    const title = '고요한 밤 </script><img src="x" onerror="alert(1)">';
    const text =
      '토끼가 "<별>"이라고 말했어요. </script><script data-injected="true">alert("story")</script>';
    vi.spyOn(storyContent, "getPublicStory").mockReturnValue({
      ...story,
      title,
      pages: [{ text }, ...story.pages.slice(1)],
    });

    const document = await renderStory(story.slug);
    const articleData = readArticleData(document);
    const jsonText = document.querySelector(
      'script[type="application/ld+json"]',
    )?.textContent;

    expect(jsonText).toContain("\\u003c/script>");
    expect(jsonText).not.toContain("</script>");
    expect(articleData.headline).toBe(title);
    expect(articleData.articleBody.split("\n\n")[0]).toBe(text);
    expect(document.querySelector("h1")?.textContent).toBe(title);
    expect(
      Array.from(document.querySelectorAll("article p")).some(
        paragraph => paragraph.textContent === text,
      ),
    ).toBe(true);
    expect(document.querySelector("[data-injected], img[onerror]")).toBeNull();
  });
});

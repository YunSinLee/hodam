import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SearchSource } from "@/lib/client/search-analytics";

const sourceKey = "hodam:search-source";

function installBrowser(initial: Record<string, string> = {}) {
  const storage = new Map(Object.entries(initial));
  const gtag = vi.fn();
  const browser = {
    gtag,
    location: {
      origin: "https://hodam.vercel.app",
      href: "https://hodam.vercel.app/my-story/987654?childName=private&email=private",
    },
    sessionStorage: {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
    },
  };
  vi.stubGlobal("window", browser);
  return { browser, storage, gtag };
}

describe("search acquisition analytics", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it("maps only the five public page paths to allowlisted sources", async () => {
    const { searchSourceForPathname } = await import(
      "@/lib/client/search-analytics"
    );
    expect(
      [
        "/bedtime-stories",
        "/ai-storybook",
        "/bedtime-stories/moonlit-rabbit",
        "/bedtime-stories/pinecone-promise",
        "/bedtime-stories/little-fox-crossing",
      ].map(searchSourceForPathname),
    ).toEqual([
      "bedtime",
      "ai-maker",
      "moonlit-rabbit",
      "pinecone-promise",
      "little-fox-crossing",
    ]);
    expect(
      [
        "/",
        "/my-story/752",
        "/service",
        "/bedtime-stories/unknown",
        "/bedtime-stories/bedtime",
        "/bedtime-stories/moonlit-rabbit/private",
        "/bedtime-stories?childName=private",
        "https://hodam.vercel.app/bedtime-stories",
      ].map(searchSourceForPathname),
    ).toEqual(Array(8).fill(null));
  });

  it("preserves only the allowlisted source across login reloads", async () => {
    const { storage, gtag } = installBrowser();
    const firstPage = await import("@/lib/client/search-analytics");
    firstPage.trackSearchCta("moonlit-rabbit");
    expect(Array.from(storage.entries())).toEqual([
      [sourceKey, "moonlit-rabbit"],
    ]);
    vi.resetModules();
    const servicePage = await import("@/lib/client/search-analytics");
    servicePage.beginSearchGeneration();
    expect(gtag.mock.calls.map(call => call[1])).toEqual([
      "hodam_cta_click",
      "hodam_generation_started",
    ]);
    expect(gtag.mock.calls[1][2].search_source).toBe("moonlit-rabbit");
  });

  it("ignores arbitrary query values and traffic without a tracked CTA", async () => {
    const { gtag } = installBrowser({ [sourceKey]: "childName=민준" });
    const analytics = await import("@/lib/client/search-analytics");
    analytics.trackSearchCta("/my-story/987654" as SearchSource);
    expect(analytics.beginSearchGeneration()).toBeNull();
    analytics.completeSearchGeneration(987654, {
      status: "complete",
      pageCount: 8,
      hasAllImages: true,
    });
    expect(gtag).not.toHaveBeenCalled();
  });

  it("counts one start for an idempotent retry and completion only when all eight illustrations exist", async () => {
    const { gtag, storage } = installBrowser();
    const analytics = await import("@/lib/client/search-analytics");
    analytics.trackSearchCta("bedtime");
    const attempt = analytics.beginSearchGeneration();
    expect(analytics.beginSearchGeneration(attempt)).toBe(attempt);
    analytics.associateSearchGeneration(attempt, 987654);
    analytics.completeSearchGeneration(987654, {
      status: "choice-ready",
      pageCount: 4,
      hasAllImages: true,
    });
    analytics.completeSearchGeneration(987654, {
      status: "complete",
      pageCount: 8,
      hasAllImages: false,
    });
    expect(gtag).toHaveBeenCalledTimes(2);
    analytics.completeSearchGeneration(987654, {
      status: "complete",
      pageCount: 8,
      hasAllImages: true,
    });
    // Re-renders, returning to the bookshelf, and a duplicate response do not
    // count the same finished book again.
    analytics.associateSearchGeneration(attempt, 987654);
    analytics.completeSearchGeneration(987654, {
      status: "complete",
      pageCount: 8,
      hasAllImages: true,
    });
    expect(gtag.mock.calls.map(call => call[1])).toEqual([
      "hodam_cta_click",
      "hodam_generation_started",
      "hodam_generation_completed",
    ]);
    expect(gtag.mock.calls[2]).toEqual([
      "event",
      "hodam_generation_completed",
      {
        search_source: "bedtime",
        page_location: "https://hodam.vercel.app/service",
        page_referrer: "",
        page_title: "그림책 만들기 | 호담",
      },
    ]);
    expect(JSON.stringify(gtag.mock.calls)).not.toMatch(
      /987654|childName|private|email/,
    );
    expect(Array.from(storage.entries())).toEqual([[sourceKey, "bedtime"]]);
  });

  it("keeps each book's original source when another CTA is clicked", async () => {
    const { gtag } = installBrowser();
    const analytics = await import("@/lib/client/search-analytics");
    analytics.trackSearchCta("bedtime");
    const attempt = analytics.beginSearchGeneration();
    analytics.associateSearchGeneration(attempt, 17);
    analytics.trackSearchCta("ai-maker");
    analytics.completeSearchGeneration(17, {
      status: "complete",
      pageCount: 8,
      hasAllImages: true,
    });
    expect(gtag.mock.calls.at(-1)?.[2].search_source).toBe("bedtime");
    expect(analytics.beginSearchGeneration()?.source).toBe("ai-maker");
  });

  it("does not treat reopening an old saved book as a new conversion", async () => {
    const { gtag } = installBrowser({ [sourceKey]: "ai-maker" });
    const analytics = await import("@/lib/client/search-analytics");
    analytics.completeSearchGeneration(752, {
      status: "complete",
      pageCount: 8,
      hasAllImages: true,
    });
    expect(gtag).not.toHaveBeenCalled();
  });

  it("continues navigation and creation when storage and GA throw", async () => {
    const { browser, gtag } = installBrowser();
    Object.defineProperty(browser, "sessionStorage", {
      get() {
        throw new Error("Storage blocked");
      },
    });
    gtag.mockImplementation(() => {
      throw new Error("Analytics blocked");
    });
    const analytics = await import("@/lib/client/search-analytics");
    expect(() => analytics.trackSearchCta("bedtime")).not.toThrow();
    const attempt = analytics.beginSearchGeneration();
    expect(attempt?.source).toBe("bedtime");
    analytics.associateSearchGeneration(attempt, 17);
    expect(() =>
      analytics.completeSearchGeneration(17, {
        status: "complete",
        pageCount: 8,
        hasAllImages: true,
      }),
    ).not.toThrow();
  });

  it("works without GA and during server rendering", async () => {
    const { browser } = installBrowser();
    Reflect.deleteProperty(browser, "gtag");
    const analytics = await import("@/lib/client/search-analytics");
    expect(() => analytics.trackSearchCta("ai-maker")).not.toThrow();
    expect(analytics.beginSearchGeneration()?.source).toBe("ai-maker");
    vi.stubGlobal("window", undefined);
    expect(() => analytics.trackSearchCta("bedtime")).not.toThrow();
    expect(analytics.beginSearchGeneration()).toBeNull();
  });
});

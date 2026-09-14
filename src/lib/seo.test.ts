import { createRequire } from "node:module";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createSiteVerification, serializeJsonLd } from "./seo";
import { DEFAULT_SITE_URL, resolveSiteUrl } from "../../config/site-url";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("production publishing URLs", () => {
  it.each([
    undefined,
    "",
    "not-a-url",
    "http://hodam.vercel.app",
    "https://localhost:3000",
    "https://localhost",
    "https://test.local",
    "https://test.internal",
    "https://127.0.0.1",
    "https://10.0.0.12",
    "https://[::1]",
    "https://hodam-git-feature-yunsinlees-projects.vercel.app",
    "https://hodam.vercel.app:3000",
    "https://user:password@hodam.vercel.app",
    "https://hodam.vercel.app/my-story",
    "https://hodam.vercel.app?utm_source=preview",
    "https://hodam.vercel.app#sample",
  ])("keeps %s out of canonical and sitemap hosts", value => {
    expect(resolveSiteUrl(value)).toBe(DEFAULT_SITE_URL);
  });

  it("normalizes a configured public HTTPS origin", () => {
    expect(resolveSiteUrl("https://HODAM.vercel.app/")).toBe(DEFAULT_SITE_URL);
    expect(resolveSiteUrl("https://stories.example.com/")).toBe(
      "https://stories.example.com",
    );
  });

  it("keeps sitemap and metadata on the same production origin during local builds", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.resetModules();
    const { SITE_URL, createPublicMetadata } = await import("./seo");
    const requireConfig = createRequire(import.meta.url);
    const configPath = requireConfig.resolve("../../next-sitemap.config.js");
    delete requireConfig.cache[configPath];
    const sitemap = requireConfig(configPath);

    expect(sitemap.siteUrl).toBe(SITE_URL);
    expect(
      createPublicMetadata({
        title: "잠자리 동화",
        description: "아이와 함께 읽는 이야기",
        path: "/bedtime-stories?utm_source=naver#stories",
      }).alternates?.canonical,
    ).toBe(`${sitemap.siteUrl}/bedtime-stories`);
    expect(sitemap.exclude).toEqual(
      expect.arrayContaining(["/my-story", "/my-story/*", "/service"]),
    );
    expect(sitemap.exclude).not.toContain("/bedtime-stories");
    expect(sitemap.exclude).not.toContain("/ai-storybook");
  });

  it.each([
    "https://preview.vercel.app/bedtime-stories",
    "//preview.vercel.app/bedtime-stories",
    "/\\preview.vercel.app/bedtime-stories",
    "/\n/preview.vercel.app/bedtime-stories",
  ])(
    "rejects a path that could override the canonical host: %j",
    async path => {
      const { createPublicMetadata } = await import("./seo");
      expect(() =>
        createPublicMetadata({ title: "동화", description: "동화 소개", path }),
      ).toThrow();
    },
  );

  it("publishes the same page identity in canonical and share metadata", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://hodam.vercel.app");
    vi.resetModules();
    const { createPublicMetadata } = await import("./seo");
    const result = createPublicMetadata({
      title: "달빛 토끼",
      description: "아이와 함께 읽는 잠자리 동화",
      path: "/bedtime-stories/moonlit-rabbit/",
      image: "/stories/moonlit-rabbit.png",
    });
    expect(result.alternates?.canonical).toBe(
      "https://hodam.vercel.app/bedtime-stories/moonlit-rabbit",
    );
    expect(result.openGraph).toMatchObject({
      url: result.alternates?.canonical,
      title: "달빛 토끼 | 호담",
      locale: "ko_KR",
      images: [
        {
          url: "https://hodam.vercel.app/stories/moonlit-rabbit.png",
          alt: "달빛 토끼",
        },
      ],
    });
    expect(result.robots).toEqual({ index: true, follow: true });
  });
});

describe("ownership verification", () => {
  it("omits unconfigured or blank tokens", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION", "");
    vi.stubEnv("NEXT_PUBLIC_NAVER_SITE_VERIFICATION", "  ");
    expect(createSiteVerification()).toBeUndefined();
  });

  it("uses supplied tokens without inventing either provider's value", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION", "google-test-token");
    vi.stubEnv("NEXT_PUBLIC_NAVER_SITE_VERIFICATION", " naver-test-token ");
    expect(createSiteVerification()).toEqual({
      google: "google-test-token",
      other: { "naver-site-verification": "naver-test-token" },
    });
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION", "");
    expect(createSiteVerification()).toEqual({
      other: { "naver-site-verification": "naver-test-token" },
    });
  });
});

describe("structured data", () => {
  it("prevents a title from ending the JSON-LD script while preserving its text", () => {
    const data = {
      "@type": "Book",
      name: '</script><script>alert("title")</script>',
      description: "작은 토끼 < 큰 달 & 친구",
    };
    const serialized = serializeJsonLd(data);
    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toEqual(data);
  });
});

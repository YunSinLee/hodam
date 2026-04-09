import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomeFeaturesSection, {
  type HomeFeature,
} from "@/app/components/home/HomeFeaturesSection";

const FEATURES: HomeFeature[] = [
  {
    icon: "🎯",
    title: "키워드 기반 생성",
    description: "키워드 입력으로 동화 생성",
  },
  {
    icon: "🌍",
    title: "다국어 지원",
    description: "한국어/영어 전환 지원",
  },
  {
    icon: "🎨",
    title: "AI 일러스트",
    description: "동화 이미지 생성 지원",
  },
];

describe("HomeFeaturesSection", () => {
  it("renders feature cards and highlights the active card", () => {
    const html = renderToStaticMarkup(
      createElement(HomeFeaturesSection, {
        features: FEATURES,
        currentFeature: 1,
      }),
    );

    expect(html).toContain("호담의 특별한 기능들");
    expect(html).toContain("키워드 기반 생성");
    expect(html).toContain("다국어 지원");
    expect(html).toContain("AI 일러스트");

    const activeRingMatches = html.match(/ring-2 ring-orange-400\/50/g) || [];
    expect(activeRingMatches).toHaveLength(1);

    const pulseIndicatorMatches =
      html.match(/animate-pulse rounded-full bg-orange-400/g) || [];
    expect(pulseIndicatorMatches).toHaveLength(1);
  });
});

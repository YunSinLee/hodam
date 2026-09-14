import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import ProfileSectionCard from "@/app/components/profile/ProfileSectionCard";

describe("ProfileSectionCard", () => {
  it("renders the title and action", () => {
    const html = renderToStaticMarkup(
      <ProfileSectionCard
        title="테스트 카드"
        actionLabel="전체보기 →"
        onAction={vi.fn()}
      >
        <p>content</p>
      </ProfileSectionCard>,
    );
    ["테스트 카드", "전체보기 →", "content"].forEach(value =>
      expect(html).toContain(value),
    );
  });
  it("renders the subtitle without an action", () => {
    const html = renderToStaticMarkup(
      <ProfileSectionCard title="테스트 카드" subtitle="subtext">
        <p>content</p>
      </ProfileSectionCard>,
    );
    ["테스트 카드", "subtext"].forEach(value => expect(html).toContain(value));
  });
});

import Image from "next/image";
import Link from "next/link";

import TrackedLink from "@/app/components/marketing/TrackedLink";
import { PUBLIC_STORIES } from "@/content/public-stories";
import { createPublicMetadata } from "@/lib/seo";

export const metadata = createPublicMetadata({
  title: "잠자리 동화 모음 — 아이와 함께 읽는 짧은 동화",
  description:
    "잠들기 전 아이와 나란히 읽는 짧은 창작 동화 3편. 토끼, 곰, 여우의 다정한 이야기를 그림과 함께 로그인 없이 끝까지 읽어보세요.",
  path: "/bedtime-stories",
  image: "/stories/moonlit-rabbit.webp",
});

export default function BedtimeStoriesPage() {
  return (
    <>
      <section className="story-library-hero">
        <div className="story-hero-art">
          <Image
            src="/stories/moonlit-rabbit.webp"
            alt="포근한 이불 속 토끼와 할머니 토끼가 작은 등불 아래 그림책을 읽어요"
            fill
            priority
            sizes="(max-width: 760px) 100vw, 70vw"
          />
        </div>
        <div className="story-hero-inner">
          <p className="eyebrow">호담의 잠자리 책장</p>
          <h1>
            잠자리 동화,
            <br />
            오늘 밤의 작은 이야기.
          </h1>
          <p className="story-hero-description">
            이불을 나눠 덮고, 한 편씩 천천히.
            <br />
            아이와 함께 읽는 짧은 동화를 모았어요.
          </p>
          <a href="#stories" className="button-primary">
            동화 골라 읽기 <span aria-hidden="true">↓</span>
          </a>
          <p className="story-hero-note">무료로 읽기 · 로그인 없이 · 끝까지</p>
        </div>
      </section>

      <section className="story-library-section" id="stories">
        <div className="story-section-heading">
          <div>
            <p className="eyebrow">오늘은 어떤 이야기를 읽을까요?</p>
            <h2>작은 마음을 따라, 세 편의 동화</h2>
          </div>
          <p>5~7세 아이와 함께 읽기 좋은 창작 이야기예요.</p>
        </div>
        <div className="story-shelf">
          {PUBLIC_STORIES.map((story, index) => (
            <article className="story-shelf-item" key={story.slug}>
              <Link
                href={`/bedtime-stories/${story.slug}`}
                className="story-cover-link"
                aria-label={`${story.title} 읽기`}
              >
                <Image
                  src={story.image.src}
                  alt={story.image.alt}
                  width={1536}
                  height={1024}
                  sizes="(max-width: 760px) 100vw, 33vw"
                />
              </Link>
              <div className="story-shelf-meta">
                <span>0{index + 1}</span>
                <span>{story.theme}</span>
                <span>약 {story.readingMinutes}분</span>
              </div>
              <h3>
                <Link href={`/bedtime-stories/${story.slug}`}>
                  {story.title}
                </Link>
              </h3>
              <p>{story.description}</p>
              <Link
                href={`/bedtime-stories/${story.slug}`}
                className="story-read-link"
              >
                이야기 읽기 <span aria-hidden="true">↗</span>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="story-reading-note">
        <p className="eyebrow">나란히 읽는 시간</p>
        <h2>마지막 문장 뒤에는, 잠깐 쉬어가도 좋아요.</h2>
        <p>
          아이가 그림을 오래 바라보면 함께 기다려주세요. 마음에 드는 장면을 다시
          읽거나, 주인공에게 한마디 건네도 좋고요. 읽는 시간은 아이의 속도에
          따라 달라져요.
        </p>
      </section>

      <section className="story-final-cta">
        <p className="eyebrow">다음 이야기의 주인공은</p>
        <h2>우리 아이의 오늘을 담아볼까요?</h2>
        <p>아이의 이름과 하루를 담은 8쪽 그림책을 함께 만들어요.</p>
        <TrackedLink
          href="/service"
          source="bedtime"
          className="button-primary"
        >
          우리 아이 그림책 만들기 <span aria-hidden="true">↗</span>
        </TrackedLink>
        <Link href="/ai-storybook" className="story-secondary-link">
          만드는 방법과 이용 안내
        </Link>
      </section>
    </>
  );
}

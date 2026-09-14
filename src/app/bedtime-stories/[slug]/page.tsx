import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import TrackedLink from "@/app/components/marketing/TrackedLink";
import { getPublicStory, PUBLIC_STORIES } from "@/content/public-stories";
import { createPublicMetadata, serializeJsonLd, SITE_URL } from "@/lib/seo";

interface StoryPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return PUBLIC_STORIES.map(story => ({ slug: story.slug }));
}

export async function generateMetadata({ params }: StoryPageProps) {
  const { slug } = await params;
  const story = getPublicStory(slug);
  if (!story) return {};
  return createPublicMetadata({
    title: `${story.title} — 짧은 잠자리 동화`,
    description: story.description,
    path: `/bedtime-stories/${story.slug}`,
    image: story.image.src,
  });
}

export default async function PublicStoryPage({ params }: StoryPageProps) {
  const { slug } = await params;
  const story = getPublicStory(slug);
  if (!story) notFound();
  const relatedStories = PUBLIC_STORIES.filter(
    item => item.slug !== story.slug,
  );
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: story.title,
    description: story.description,
    inLanguage: "ko-KR",
    image: `${SITE_URL}${story.image.src}`,
    author: { "@type": "Organization", name: "호담", url: SITE_URL },
    publisher: { "@type": "Organization", name: "호담", url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}/bedtime-stories/${story.slug}`,
    articleBody: story.pages.map(page => page.text).join("\n\n"),
  };
  return (
    <>
      <script
        type="application/ld+json"
        // Only reviewed, repository-owned public content enters this script.
        // Escaping '<' also prevents an HTML closing tag from breaking out.
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(structuredData),
        }}
      />
      <article className="public-story">
        <header className="public-story-header">
          <Link href="/bedtime-stories" className="story-back-link">
            <span aria-hidden="true">←</span> 잠자리 동화 모음
          </Link>
          <p className="eyebrow">호담의 짧은 동화 · {story.theme}</p>
          <h1>{story.title}</h1>
          <p className="public-story-description">{story.description}</p>
          <p className="public-story-meta">
            {story.ageLabel} · 함께 읽기 약 {story.readingMinutes}분 · 호담 창작
            동화
          </p>
        </header>
        <figure className="public-story-illustration">
          <Image
            src={story.image.src}
            alt={story.image.alt}
            width={1536}
            height={1024}
            priority
            sizes="(max-width: 900px) 100vw, 900px"
          />
        </figure>
        <div className="public-story-body">
          {story.pages.map((page, index) => (
            <div className="public-story-passage" key={page.text}>
              <span className="public-story-page-number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p>{page.text}</p>
            </div>
          ))}
          <p className="public-story-end">이야기 끝. 오늘도, 잘 자요.</p>
        </div>
      </article>

      <section className="story-final-cta">
        <p className="eyebrow">이야기가 마음에 남았다면</p>
        <h2>우리 아이의 이야기로 이어가요.</h2>
        <p>오늘 있었던 작은 일을 들려주면, 아이를 위한 그림책이 시작돼요.</p>
        <TrackedLink
          href="/service"
          source={story.slug}
          className="button-primary"
        >
          우리 아이 그림책 만들기 <span aria-hidden="true">↗</span>
        </TrackedLink>
        <Link href="/ai-storybook" className="story-secondary-link">
          만드는 방법과 이용 안내
        </Link>
      </section>

      <nav className="story-related" aria-label="다른 잠자리 동화">
        <h2>다음 밤을 위한 이야기</h2>
        {relatedStories.map(item => (
          <Link href={`/bedtime-stories/${item.slug}`} key={item.slug}>
            <span>{item.title}</span>
            <span aria-hidden="true">↗</span>
          </Link>
        ))}
        <Link href="/bedtime-stories">동화 모음으로 돌아가기</Link>
      </nav>
    </>
  );
}

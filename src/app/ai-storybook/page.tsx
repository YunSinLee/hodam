import Image from "next/image";
import Link from "next/link";

import TrackedLink from "@/app/components/marketing/TrackedLink";
import { createPublicMetadata } from "@/lib/seo";

import "@/styles/marketing.css";

export const metadata = createPublicMetadata({
  title: "AI 동화책 만들기 — 우리 아이를 위한 8쪽 그림책",
  description:
    "아이의 이름과 오늘 있었던 일로 AI 동화책을 만들어보세요. 첫 4쪽을 읽고 다음 장면을 고르면 결말까지 8쪽 그림책이 완성돼요. 호담의 예시와 이용 방법을 확인하세요.",
  path: "/ai-storybook",
  image: "/stories/pinecone-promise.webp",
});

export default function AiStorybookPage() {
  return (
    <>
      <section className="story-library-hero maker-hero">
        <div className="story-hero-art">
          <Image
            src="/stories/pinecone-promise.webp"
            alt="곰과 다람쥐가 나란히 앉아 솔방울 꽃과 작은 나뭇가지 길을 바라봐요"
            fill
            priority
            sizes="(max-width: 760px) 100vw, 70vw"
          />
        </div>
        <div className="story-hero-inner">
          <p className="eyebrow">호담 · AI 동화책 만들기</p>
          <h1>
            아이의 오늘이,
            <br />한 권의 그림책으로.
          </h1>
          <p className="story-hero-description">
            이름과 하루의 작은 순간을 들려주세요.
            <br />
            함께 고른 다음 장면이, 우리만의 결말이 돼요.
          </p>
          <TrackedLink
            href="/service"
            source="ai-maker"
            className="button-primary"
          >
            우리 아이 그림책 만들기 <span aria-hidden="true">↗</span>
          </TrackedLink>
          <p className="story-hero-note">
            8쪽 디지털 그림책 · 한 권에 곶감 1개
          </p>
        </div>
      </section>

      <section className="maker-introduction">
        <p className="eyebrow">동화책 만들기, 이렇게 시작해요</p>
        <h2>잘 쓴 문장보다, 오늘 있었던 일 하나.</h2>
        <p>
          “친구에게 장난감을 빌려주기 어려웠어요.” 짧은 한 문장이면 충분해요.
          아이의 나이와 상황에 맞춰 AI가 글과 그림을 만들고, 아이는 다음
          장면에서 해볼 행동을 골라요.
        </p>
        <ol className="maker-steps">
          <li>
            <span aria-hidden="true">01</span>
            <h3>오늘의 순간을 적어요</h3>
            <p>이름이나 별명, 나이, 이야기에 담고 싶은 일을 알려주세요.</p>
          </li>
          <li>
            <span aria-hidden="true">02</span>
            <h3>다음 장면을 함께 골라요</h3>
            <p>첫 4쪽을 읽고 세 가지 작은 행동 중 하나를 선택해요.</p>
          </li>
          <li>
            <span aria-hidden="true">03</span>
            <h3>마지막 장까지 읽어요</h3>
            <p>선택에 따른 결말 4쪽이 이어지고, 내 책장에서 다시 읽어요.</p>
          </li>
        </ol>
      </section>

      <section className="maker-sample">
        <Link
          href="/bedtime-stories/pinecone-promise"
          className="maker-sample-art"
        >
          <Image
            src="/stories/pinecone-promise.webp"
            alt="공개 동화 속 곰과 다람쥐가 함께 노는 장면"
            width={1536}
            height={1024}
            sizes="(max-width: 760px) 100vw, 50vw"
          />
        </Link>
        <div>
          <p className="eyebrow">읽어보고, 시작해도 좋아요</p>
          <h2>먼저 이야기 한 편을 만나보세요.</h2>
          <p>
            호담이 준비한 공개 동화는 로그인 없이 끝까지 읽을 수 있어요. 아이가
            다음 장면을 고르는 제작 흐름도 따로 체험할 수 있어요.
          </p>
          <Link href="/bedtime-stories" className="story-read-link">
            공개 동화 읽기 <span aria-hidden="true">↗</span>
          </Link>
          <Link href="/sample" className="story-secondary-link">
            선택하며 읽는 흐름 체험하기
          </Link>
        </div>
      </section>

      <section className="maker-faq">
        <p className="eyebrow">이용하기 전에</p>
        <h2>AI 동화책 만들기, 궁금한 점</h2>
        <details open>
          <summary>무료로 읽고 만들 수 있나요?</summary>
          <p>
            공개 동화와 제작 흐름 미리보기는 무료예요. 우리 아이에 맞춘 그림책을
            만들려면 로그인과 곶감 1개가 필요해요. 결말 선택에는 추가 곶감이
            들지 않아요. 보유 수량과 충전 가격은{" "}
            <Link href="/bead" className="text-link">
              곶감 상점
            </Link>
            에서 확인할 수 있어요.
          </p>
        </details>
        <details>
          <summary>완성된 동화책은 어떤 형태인가요?</summary>
          <p>
            호담에서 읽는 8쪽 디지털 그림책이에요. 계정의 내 책장에 저장되며,
            종이책 인쇄나 배송은 제공하지 않아요.
          </p>
        </details>
        <details>
          <summary>그림책이 완성될 때까지 얼마나 걸리나요?</summary>
          <p>
            글을 쓰는 데 수십 초가 걸릴 수 있고, 그림 8장은 더 오래 걸릴 수
            있어요. 글부터 먼저 읽을 수 있으며 그림을 만드는 동안에는 화면을
            열어두세요.
          </p>
        </details>
        <details>
          <summary>어떤 정보를 입력하나요?</summary>
          <p>
            아이의 이름이나 별명, 나이, 오늘 있었던 일을 적어요. 주소나 연락처는
            필요하지 않아요. 생성된 동화는 보호자가 먼저 읽고 아이와 함께
            즐겨주세요.
          </p>
        </details>
      </section>

      <section className="story-final-cta">
        <p className="eyebrow">오늘 밤, 함께 읽을 한 권</p>
        <h2>오늘의 작은 순간부터 시작해요.</h2>
        <TrackedLink
          href="/service"
          source="ai-maker"
          className="button-primary"
        >
          우리 아이 그림책 만들기 <span aria-hidden="true">↗</span>
        </TrackedLink>
      </section>
    </>
  );
}

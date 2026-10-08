/* eslint-disable @next/next/no-img-element */
// Reuse the static sample illustration without a separate image request.
import Link from "next/link";

import TrackedLink from "@/app/components/marketing/TrackedLink";
import { createPublicMetadata } from "@/lib/seo";

export const metadata = createPublicMetadata({
  title: "아이의 하루를 담는 AI 잠자리 그림책",
  description:
    "아이의 이름과 오늘 있었던 일로 만드는 8쪽 AI 그림책. 무료 잠자리 동화를 먼저 읽고, 우리 아이만의 이야기를 함께 만들어보세요.",
  path: "/",
});

export default function Home() {
  return (
    <>
      <section className="home-hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">호담 · 오늘을 담은 그림책</p>
            <h1>
              오늘 있었던 일이,
              <br />
              <em>
                아이가 주인공인
                <br />
                그림책으로.
              </em>
            </h1>
            <p className="hero-description">
              처음이라 무서웠던 마음도, 친구에게 서운했던 마음도.
              <br />
              우리 아이의 이름과 하루를 담아
              <br />
              잠들기 전 함께 읽는 이야기를 만들어요.
            </p>
            <div className="hero-actions">
              <TrackedLink
                href="/sample"
                source="home"
                className="button-primary"
              >
                무료 그림책 먼저 읽기 <span aria-hidden="true">↗</span>
              </TrackedLink>
              <TrackedLink
                href="/service"
                source="home"
                className="button-secondary"
              >
                우리 아이 그림책 만들기
              </TrackedLink>
            </div>
            <p className="hero-note">
              무료 체험은 로그인 없이 · 새 그림책 1권은 곶감 1개
            </p>
          </div>
          <figure className="book-scene">
            <TrackedLink
              href="/sample"
              source="home"
              className="hero-story-preview"
              aria-label="작은 용기를 빌려줄게 무료 그림책 읽기"
            >
              <img
                src="/sample/little-courage/page-1.webp"
                width="1254"
                height="1254"
                alt="처음 가는 유치원 앞에서 엄마 손을 잡고 작은 용기를 내는 아이"
                fetchPriority="high"
              />
              <div className="hero-story-caption">
                <small>무료로 읽는 호담의 그림책</small>
                <h2>작은 용기를 빌려줄게</h2>
                <p>“노란 문 앞에서 민준이의 발끝이 멈췄어요.”</p>
                <span>
                  다음 장면을 함께 골라보세요 <span aria-hidden="true">↗</span>
                </span>
              </div>
            </TrackedLink>
          </figure>
        </div>
      </section>
      <div className="home-strip">
        <span>아이의 상황을 담은 이야기</span>
        <span>함께 고르는 세 가지 선택</span>
        <span>PDF로 간직하는 8쪽 그림책</span>
      </div>
      <section className="home-section home-adventure">
        <div>
          <p className="eyebrow">아이와 단짝의 상상 모험</p>
          <h2>
            오늘은 달나라 빵집,
            <br />
            다음에는 어디로 갈까요?
          </h2>
          <p>
            마음에 드는 단짝에게 이름을 지어주세요.
            <br />한 권을 다 읽으면, 같은 단짝과 새로운 모험을 떠날 수 있어요.
          </p>
        </div>
        <div>
          <p className="adventure-destinations">
            달나라 빵집 · 공룡 우체국 · 바닷속 도서관
          </p>
          <TrackedLink
            href="/service?mode=adventure"
            source="home"
            className="button-primary"
          >
            우리의 첫 모험 고르기 →
          </TrackedLink>
          <p className="field-help">
            장소와 단짝만 골라도 좋아요. 교훈은 적지 않아도 돼요.
          </p>
        </div>
      </section>
      <section className="home-section">
        <div className="section-intro">
          <h2>
            오늘은 어떤 마음을
            <br />
            이야기에 담아볼까요?
          </h2>
          <p>
            거창한 이야깃거리가 없어도 괜찮아요.
            <br />
            하루의 작은 순간 하나면 충분해요.
          </p>
        </div>
        <div className="story-examples">
          <TrackedLink href="/service?example=brushing" source="home">
            <small>생활 습관</small>
            <h3>“양치는 내일 할래요.”</h3>
            <p>
              칫솔 앞에서 꼭 다문 입.
              <br />
              작은 시도를 응원하는 이야기.
            </p>
            <span>이 상황으로 시작하기 ↗</span>
          </TrackedLink>
          <TrackedLink href="/service?example=friends" source="home">
            <small>친구와의 하루</small>
            <h3>“내 장난감인데…”</h3>
            <p>
              친구에게 건네기 어려웠던 마음.
              <br />
              천천히 함께 노는 이야기.
            </p>
            <span>이 상황으로 시작하기 ↗</span>
          </TrackedLink>
          <TrackedLink href="/service?example=dark" source="home">
            <small>잠들기 전 마음</small>
            <h3>“불을 끄면 무서워요.”</h3>
            <p>
              이불 밖이 낯설게 느껴지는 밤.
              <br />
              곁에 있는 온기를 찾는 이야기.
            </p>
            <span>이 상황으로 시작하기 ↗</span>
          </TrackedLink>
        </div>
      </section>
      <section className="how-section">
        <div className="how-inner">
          <div>
            <p className="eyebrow">함께 만드는 잠자리</p>
            <h2>
              이야기를 만드는 시간도,
              <br />
              함께 읽는 시간도.
            </h2>
            <p>
              그림책 한 권에 곶감 1개가 필요해요.
              <br />
              이야기를 먼저 읽는 동안 그림이 차례로 채워져요.
            </p>
          </div>
          <ol>
            <li>
              <span>01</span>
              <div>
                <h3>오늘의 순간을 들려주세요</h3>
                <p>아이의 이름, 나이, 오늘 있었던 일을 적어요.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>다음 장면을 함께 골라요</h3>
                <p>첫 4쪽을 읽고 아이가 해볼 작은 행동을 선택해요.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>마지막 장까지, 포근하게</h3>
                <p>결말까지 함께 읽고, 그림이 담긴 PDF로 간직해요.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>
      <section className="home-faq">
        <h2>시작하기 전에 궁금한 것들</h2>
        <details>
          <summary>곶감은 무엇인가요?</summary>
          <p>
            그림책을 만들 때 사용하는 이용권이에요. 8쪽 그림책 한 권에 곶감
            1개가 필요하며, 결말 선택에는 추가 곶감이 들지 않아요. 로그인하면
            보유 수량을 확인할 수 있어요.
          </p>
        </details>
        <details>
          <summary>그림책을 만드는 데 얼마나 걸리나요?</summary>
          <p>
            이야기를 쓰는 데 수십 초가 걸릴 수 있고, 그림 8장은 더 오래 걸릴 수
            있어요. 글이 완성되면 먼저 읽을 수 있어요. 그림이 준비되는 동안에는
            화면을 열어두세요.
          </p>
        </details>
        <details>
          <summary>어떤 내용을 입력하면 좋나요?</summary>
          <p>
            “친구에게 장난감을 빌려주기 어려웠어요”처럼 짧게 적어주세요. 이름은
            별명으로 적어도 좋아요. 주소, 연락처 등 이야기와 관계없는 정보는
            넣지 않아도 돼요.
          </p>
        </details>
        <details>
          <summary>만든 이야기를 다시 읽을 수 있나요?</summary>
          <p>
            로그인한 계정의 내 책장에 보관돼요. 아직 결말을 고르지 않은 그림책도
            내 책장에서 이어 만들 수 있어요. 계정에 저장한 좋아하는 책과 읽던
            위치는 다른 기기에서도 이어볼 수 있고, 모험 그림책은 단짝별로 모아
            볼 수 있어요. 현재 베타 서비스로, 운영 변경 시 데이터가 초기화될 수
            있어요.
          </p>
        </details>
        <details>
          <summary>만든 그림책을 파일로 간직할 수 있나요?</summary>
          <p>
            마지막 쪽에서 표지와 그림, 이야기가 담긴 PDF를 저장할 수 있어요.
            그림이 모두 준비된 뒤 저장하면 온전한 그림책을 간직할 수 있어요.
            다시 읽기와 PDF 저장에는 곶감을 사용하지 않아요.
          </p>
        </details>
      </section>
      <section className="home-section">
        <div className="section-intro">
          <h2>오늘의 작은 순간으로 시작해보세요.</h2>
          <p>한두 문장이면 충분해요. 아이의 나이에 맞춰 이야기를 엮어드려요.</p>
        </div>
        <div className="hero-actions">
          <TrackedLink href="/service" source="home" className="button-primary">
            우리 아이 그림책 만들기 ↗
          </TrackedLink>
          <Link href="/ai-storybook" className="button-secondary">
            AI 동화책 만드는 방법
          </Link>
        </div>
      </section>
    </>
  );
}

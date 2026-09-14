/* eslint-disable @next/next/no-img-element */
// Native images support signed private URLs or local SVG illustrations.
import Link from "next/link";

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
            <p className="eyebrow">오늘 하루, 한 권의 이야기</p>
            <h1>
              작은 마음이 자라는
              <br />
              <em>오늘 밤의 그림책.</em>
            </h1>
            <p className="hero-description">
              양치가 싫었던 날도, 용기를 냈던 날도.
              <br />
              아이의 하루를 담은 8쪽 그림책을 만들고
              <br />
              잠들기 전, 나란히 읽어주세요.
            </p>
            <div className="hero-actions">
              <Link href="/service" className="button-primary">
                우리 아이 그림책 만들기 <span aria-hidden="true">↗</span>
              </Link>
              <Link href="/bedtime-stories" className="button-secondary">
                잠자리 동화 읽어보기
              </Link>
            </div>
            <p className="hero-note">
              그림책 1권 · 곶감 1개 &nbsp; / &nbsp; 미리보기는 로그인 없이
            </p>
          </div>
          <figure className="book-scene">
            <div className="hero-book">
              <small>호담의 잠자리 책장 · 미리보기</small>
              <h2>
                작은 용기를
                <br />
                빌려줄게
              </h2>
              <img
                src="/hodam.png"
                width="210"
                height="216"
                alt="책을 읽어주는 다정한 호랑이 호담"
                fetchPriority="high"
              />
              <p>민준이의 하루에서 시작된 이야기</p>
            </div>
            <figcaption>
              아이의 이름으로 시작하고, 아이의 선택으로 이어져요.
            </figcaption>
          </figure>
        </div>
      </section>
      <div className="home-strip">
        <span>아이의 상황을 담은 이야기</span>
        <span>함께 고르는 세 가지 선택</span>
        <span>내 책장에 보관하는 8쪽 그림책</span>
      </div>
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
          <Link href="/service?example=brushing">
            <small>생활 습관</small>
            <h3>“양치는 내일 할래요.”</h3>
            <p>
              칫솔 앞에서 꼭 다문 입.
              <br />
              작은 시도를 응원하는 이야기.
            </p>
            <span>이 상황으로 시작하기 ↗</span>
          </Link>
          <Link href="/service?example=friends">
            <small>친구와의 하루</small>
            <h3>“내 장난감인데…”</h3>
            <p>
              친구에게 건네기 어려웠던 마음.
              <br />
              천천히 함께 노는 이야기.
            </p>
            <span>이 상황으로 시작하기 ↗</span>
          </Link>
          <Link href="/service?example=dark">
            <small>잠들기 전 마음</small>
            <h3>“불을 끄면 무서워요.”</h3>
            <p>
              이불 밖이 낯설게 느껴지는 밤.
              <br />
              곁에 있는 온기를 찾는 이야기.
            </p>
            <span>이 상황으로 시작하기 ↗</span>
          </Link>
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
                <p>선택에 맞는 결말 4쪽을 읽고 내 책장에 간직해요.</p>
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
            내 책장에서 이어 만들 수 있어요. 현재 베타 서비스로, 운영 변경 시
            데이터가 초기화될 수 있어요.
          </p>
        </details>
      </section>
      <section className="home-section">
        <div className="section-intro">
          <h2>오늘 밤의 이야기를 만나보세요.</h2>
          <p>로그인 없이 읽는 동화부터, 아이를 위한 그림책 만들기까지.</p>
        </div>
        <div className="hero-actions">
          <Link href="/bedtime-stories" className="button-primary">
            잠자리 동화 모음 ↗
          </Link>
          <Link href="/ai-storybook" className="button-secondary">
            AI 동화책 만드는 방법
          </Link>
        </div>
      </section>
    </>
  );
}

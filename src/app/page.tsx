"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

const FEATURE_ITEMS = [
  {
    title: "키워드 기반 스토리",
    description:
      "아이 이름, 장소, 사물만 입력하면 자연스러운 전개를 가진 동화가 만들어집니다.",
    tone: "from-[#f9b26b] to-[#f28c3a]",
  },
  {
    title: "선택형 분기 진행",
    description:
      "각 장면마다 다음 전개를 고를 수 있어 아이와 함께 인터랙티브하게 이야기를 완성할 수 있어요.",
    tone: "from-[#f7c972] to-[#f2a149]",
  },
  {
    title: "번역/이미지 확장",
    description:
      "영어 번역과 일러스트를 옵션으로 추가해 학습용 또는 취침 전 읽기용으로 바로 활용 가능합니다.",
    tone: "from-[#f4a96d] to-[#ed7f34]",
  },
];

const FLOW_STEPS = [
  {
    title: "키워드 입력",
    description: "예: 민지, 고양이, 우주, 무지개",
  },
  {
    title: "AI 생성",
    description: "약 30초 내외로 이야기 초안 생성",
  },
  {
    title: "선택형 진행",
    description: "분기 선택으로 스토리 방향 확정",
  },
  {
    title: "저장/다시보기",
    description: "내 동화에서 언제든 재열람",
  },
];

const USE_CASES = [
  {
    title: "취침 전 10분 루틴",
    body: "매일 다른 키워드로 잠들기 전 이야기 시간을 만듭니다.",
  },
  {
    title: "영어 노출 놀이",
    body: "같은 문장을 한/영으로 함께 보며 자연스럽게 표현을 익힙니다.",
  },
  {
    title: "학급 활동 자료",
    body: "주제 키워드로 수업 도입용 짧은 동화를 빠르게 생성합니다.",
  },
];

export default function Home() {
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveFeatureIndex(prev => (prev + 1) % FEATURE_ITEMS.length);
    }, 3200);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="hodam-page-shell relative">
      <div className="pointer-events-none absolute -left-20 top-24 h-56 w-56 rounded-full bg-[#ffe2be]/70 blur-3xl hodam-orb" />
      <div className="pointer-events-none absolute -right-16 top-[28rem] h-56 w-56 rounded-full bg-[#ffd7aa]/60 blur-3xl hodam-orb [animation-delay:2s]" />

      <section className="relative mx-auto max-w-6xl px-4 pb-14 pt-10 sm:px-6 lg:px-8">
        <div className="hodam-glass-card p-7 sm:p-10 lg:p-14">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#ef8d3d]/20 bg-white/80 px-4 py-2 text-xs font-semibold text-[#a85b18]">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-[#ef8d3d]" />
            맞춤형 AI 동화 생성 서비스
          </div>

          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <h1 className="hodam-heading text-4xl leading-tight text-[#2f3033] sm:text-5xl lg:text-6xl">
                아이의 상상을
                <br />
                <span className="bg-gradient-to-r from-[#ea8c3c] via-[#f0a34a] to-[#d86b2a] bg-clip-text text-transparent">
                  오늘의 이야기로
                </span>
                <br />
                완성하는 호담
              </h1>

              <p className="mt-6 max-w-2xl text-base text-[#4b5563] sm:text-lg">
                키워드만 입력하면 AI가 분기형 동화를 만들고, 필요하면
                영어/이미지까지 확장합니다. 로그인 후 바로 첫 동화를
                생성해보세요.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/service"
                  className="hodam-primary-button text-sm sm:text-base"
                >
                  동화 만들기 시작
                  <span aria-hidden>→</span>
                </Link>
                <Link
                  href="/sign-in"
                  className="hodam-outline-button text-sm sm:text-base"
                >
                  로그인 후 이어서 만들기
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <span className="hodam-chip">무료 체험 가능</span>
                <span className="hodam-chip">한국어/영어 지원</span>
                <span className="hodam-chip">선택형 스토리 진행</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="hodam-soft-card p-5">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#a05a1a]">
                  입력 예시
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="hodam-chip">민지</span>
                  <span className="text-[#b06a27]">+</span>
                  <span className="hodam-chip">고양이</span>
                  <span className="text-[#b06a27]">+</span>
                  <span className="hodam-chip">우주정거장</span>
                </div>
                <p className="mt-4 text-sm text-[#4b5563]">
                  생성된 이야기에서 다음 전개를 직접 선택해 결말까지 이어갈 수
                  있습니다.
                </p>
              </div>

              <div className="hodam-soft-card p-5">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#a05a1a]">
                  기대 효과
                </p>
                <ul className="mt-3 space-y-2 text-sm text-[#4b5563]">
                  <li>• 아이 이름/관심사를 반영한 맞춤 몰입</li>
                  <li>• 분기 선택을 통한 대화형 독서 경험</li>
                  <li>• 번역 기능으로 자연스러운 영어 노출</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FLOW_STEPS.map((step, index) => (
            <article key={step.title} className="hodam-soft-card p-4 sm:p-5">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#b86a22]">
                STEP {index + 1}
              </p>
              <h2 className="mt-2 text-lg font-bold text-[#2f3033]">
                {step.title}
              </h2>
              <p className="mt-2 text-sm text-[#6b7280]">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-[#ef8d3d]/20 bg-white/85 p-6 shadow-[0_22px_46px_rgba(181,94,23,0.11)] sm:p-8">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#a05a1a]">
                Core Features
              </p>
              <h2 className="hodam-heading mt-2 text-2xl text-[#2f3033] sm:text-3xl">
                서비스 핵심 기능
              </h2>
            </div>
            <p className="text-sm text-[#6b7280]">
              비로그인에서도 구조 확인 후 바로 로그인 전환
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {FEATURE_ITEMS.map((feature, index) => {
              const isActive = index === activeFeatureIndex;
              return (
                <article
                  key={feature.title}
                  className={`rounded-2xl border p-5 transition-all duration-500 ${
                    isActive
                      ? "border-[#ef8d3d]/50 bg-[#fff8ee] shadow-[0_16px_34px_rgba(226,132,42,0.18)]"
                      : "border-[#ef8d3d]/20 bg-white"
                  }`}
                >
                  <div
                    className={`h-1.5 w-14 rounded-full bg-gradient-to-r ${feature.tone}`}
                  />
                  <h3 className="mt-4 text-lg font-bold text-[#2f3033]">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">
                    {feature.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {USE_CASES.map(item => (
            <article key={item.title} className="hodam-soft-card p-5">
              <h3 className="text-lg font-bold text-[#2f3033]">{item.title}</h3>
              <p className="mt-2 text-sm text-[#6b7280]">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[28px] border border-[#ef8d3d]/30 bg-gradient-to-r from-[#ef8d3d] via-[#f3a546] to-[#d9772e] p-8 text-white sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">
                Ready to Start
              </p>
              <h2 className="hodam-heading mt-3 text-3xl sm:text-4xl">
                오늘의 키워드로 첫 동화를 만들어보세요
              </h2>
              <p className="mt-3 text-sm text-white/85 sm:text-base">
                로그인 후 1분 안에 생성을 시작할 수 있습니다.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Link
                href="/service"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-bold text-[#b95f1b] transition hover:bg-[#fff4e6]"
              >
                서비스로 이동
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex items-center justify-center rounded-full border border-white/60 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                로그인하기
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

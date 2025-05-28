"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentFeature, setCurrentFeature] = useState(0);

  const features = [
    {
      icon: "🎯",
      title: "키워드 기반 생성",
      description: "원하는 키워드만 입력하면 맞춤형 동화가 완성됩니다",
    },
    {
      icon: "🌍",
      title: "다국어 지원",
      description: "한국어와 영어로 동화를 즐길 수 있습니다",
    },
    {
      icon: "🎨",
      title: "AI 일러스트",
      description: "동화에 어울리는 아름다운 그림을 자동으로 생성합니다",
    },
  ];

  useEffect(() => {
    setIsLoaded(true);
    const interval = setInterval(() => {
      setCurrentFeature(prev => (prev + 1) % features.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 transition-opacity duration-1000 ${isLoaded ? "opacity-100" : "opacity-0"}`}
    >
      {/* 히어로 섹션 */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-400/10 to-amber-400/10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20">
          <div className="text-center">
            <div className="mb-8 animate-bounce">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full shadow-lg">
                <span className="text-3xl">📚</span>
              </div>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                호담
              </span>
              <br />
              <span className="text-2xl sm:text-3xl lg:text-4xl font-medium text-gray-700">
                AI가 만드는 나만의 동화
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              키워드 몇 개만 입력하면 AI가 특별한 동화를 만들어드립니다.
              <br />
              상상력이 현실이 되는 마법 같은 경험을 시작해보세요.
            </p>

            {/* 키워드 예시 */}
            <div className="mb-12">
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-white rounded-full shadow-lg border border-orange-100">
                <span className="text-gray-600">예시:</span>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                    철수
                  </span>
                  <span className="text-gray-400">+</span>
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                    호랑이
                  </span>
                  <span className="text-gray-400">+</span>
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                    사과
                  </span>
                </div>
                <span className="text-gray-400">→</span>
                <span className="text-orange-600 font-medium">
                  ✨ 동화 완성!
                </span>
              </div>
            </div>

            {/* CTA 버튼 */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="./service" className="group">
                <div className="relative overflow-hidden bg-gradient-to-r from-orange-500 to-amber-500 text-white px-8 py-4 rounded-full font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-amber-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="relative flex items-center gap-2">
                    🚀 지금 시작하기
                  </span>
                </div>
              </Link>

              <div className="flex items-center gap-2 text-sm text-gray-500">
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                무료 체험 가능
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 기능 소개 섹션 */}
      <section className="py-16 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              호담의 특별한 기능들
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              최신 AI 기술로 만드는 개인 맞춤형 동화 서비스
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`relative p-6 bg-white rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-500 transform hover:-translate-y-2 ${
                  currentFeature === index
                    ? "ring-2 ring-orange-400 ring-opacity-50"
                    : ""
                }`}
              >
                <div className="text-center">
                  <div className="text-4xl mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
                {currentFeature === index && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-orange-400 rounded-full animate-pulse" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 튜토리얼 비디오 섹션 */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              호담 사용법
            </h2>
            <p className="text-lg text-gray-600">
              간단한 영상으로 호담 사용법을 확인해보세요
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-r from-orange-400 to-amber-400 p-1">
              <div className="bg-black rounded-xl overflow-hidden">
                <video
                  className="w-full aspect-video"
                  controls
                  autoPlay
                  muted
                  poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 675'%3E%3Crect width='1200' height='675' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='system-ui' font-size='48' fill='%236b7280'%3E호담 튜토리얼%3C/text%3E%3C/svg%3E"
                >
                  <source src="/hodam_tutorial.mp4" type="video/mp4" />
                </video>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 사용 안내 섹션 */}
      <section className="py-16 bg-gradient-to-r from-orange-50 to-amber-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-3xl shadow-xl p-8 sm:p-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                이용 안내
              </h2>
              <p className="text-lg text-gray-600">
                호담을 더 잘 활용하기 위한 안내사항입니다
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* 베타 서비스 안내 */}
              <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-blue-900">
                    베타 서비스
                  </h3>
                </div>
                <p className="text-blue-800">
                  현재 베타 버전으로 운영 중입니다. 회원가입 시 제공되는
                  곶감으로만 이용 가능하며, 정식 출시 시 데이터가 초기화될 수
                  있습니다.
                </p>
              </div>

              {/* 처리 시간 안내 */}
              <div className="bg-yellow-50 rounded-2xl p-6 border border-yellow-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-yellow-900">
                    처리 시간
                  </h3>
                </div>
                <p className="text-yellow-800">
                  AI가 동화를 생성하는 데 약 30초 이상 소요됩니다. 고품질의
                  결과물을 위해 조금만 기다려주세요.
                </p>
              </div>

              {/* 문의 안내 */}
              <div className="bg-green-50 rounded-2xl p-6 border border-green-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-green-900">
                    문의 및 제안
                  </h3>
                </div>
                <p className="text-green-800 mb-3">
                  서비스 개선을 위한 소중한 의견을 기다립니다.
                </p>
                <a
                  href="mailto:dldbstls7777@naver.com"
                  className="inline-flex items-center gap-2 text-green-700 font-medium hover:text-green-800 transition-colors"
                >
                  <span>dldbstls7777@naver.com</span>
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 최종 CTA 섹션 */}
      <section className="py-20 bg-gradient-to-r from-orange-500 to-amber-500">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            지금 바로 나만의 동화를 만들어보세요!
          </h2>
          <p className="text-xl text-orange-100 mb-8 max-w-2xl mx-auto">
            키워드 몇 개로 시작하는 특별한 이야기 여행
          </p>

          <Link href="./service" className="group inline-block">
            <div className="bg-white text-orange-600 px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 group-hover:bg-orange-50">
              <span className="flex items-center gap-2">
                ✨ 동화 만들기 시작
                <svg
                  className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* 배경 장식 요소 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-orange-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" />
        <div
          className="absolute top-3/4 right-1/4 w-64 h-64 bg-amber-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"
          style={{ animationDelay: "2s" }}
        />
        <div
          className="absolute top-1/2 left-1/2 w-64 h-64 bg-orange-300 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse"
          style={{ animationDelay: "4s" }}
        />
      </div>
    </div>
  );
}

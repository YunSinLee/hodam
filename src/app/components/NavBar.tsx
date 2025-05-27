"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import beadApi from "@/app/api/bead";
import userApi from "@/app/api/user";
import { supabase } from "@/app/utils/supabase";
import useBead, {
  defaultState as defaultBeadState,
} from "@/services/hooks/use-bead";
import useUserInfo, {
  defaultState as defaultUserInfoState,
} from "@/services/hooks/use-user-info";

export default function NavBar() {
  const { userInfo, setUserInfo } = useUserInfo();
  const { bead, setBead } = useBead();
  const [isShowMenu, setIsShowMenu] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();

  async function signOut() {
    await userApi.signOut();
    location.reload();
  }

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 초기 세션 복원
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user && !userInfo.id) {
          console.log("세션 복원 중:", session.user.email);
          const userData = {
            profileUrl: session.user.user_metadata?.avatar_url || "",
            id: session.user.id,
            email: session.user.email,
          };
          setUserInfo(userData);
        }
      } catch (error) {
        console.error("세션 복원 오류:", error);
      }
    };

    initializeAuth();
  }, []);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state changed:", event, session?.user?.email);

        if (event === "SIGNED_OUT") {
          setUserInfo(defaultUserInfoState);
          setBead(defaultBeadState);
        }

        if (event === "SIGNED_IN" && session?.user) {
          const { user } = session;
          const userData = {
            profileUrl: user.user_metadata?.avatar_url || "",
            id: user.id,
            email: user.email,
          };
          setUserInfo(userData);

          // 사용자 정보가 users 테이블에 있는지 확인하고 없으면 생성
          try {
            const existingUser = await userApi.getUserProfile(user.id);
            if (!existingUser) {
              console.log("Creating user profile in database...");
              // 트리거가 자동으로 처리하지만, 혹시 모를 경우를 대비
            }
          } catch (error) {
            console.error("Error checking user profile:", error);
          }

          // 로그인 페이지에서 메인으로 리다이렉트
          if (pathname === "/sign-in") {
            window.location.href = "/";
          }
        }

        if (event === "TOKEN_REFRESHED") {
          console.log("Token refreshed successfully");
        }
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [pathname, setUserInfo, setBead]);

  useEffect(() => {
    const fetchBead = async () => {
      if (userInfo.id) {
        const beadInfo = await beadApi.initializeBead(userInfo.id);
        setBead(beadInfo);
      }
    };

    fetchBead();
  }, [userInfo.id]);

  const navItems = [
    { href: "/", label: "홈", icon: "🏠" },
    { href: "/service", label: "시작하기", icon: "✨" },
    { href: "/my-story", label: "내 동화", icon: "📚" },
  ];

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-white/80 backdrop-blur-lg shadow-lg border-b border-orange-100/50"
            : "bg-white/60 backdrop-blur-sm"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* 로고 영역 */}
            <Link href="/" className="group flex items-center space-x-3">
              <div className="relative">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                  <img
                    src="/hodam.png"
                    className="w-6 h-6 sm:w-8 sm:h-8 filter brightness-0 invert"
                    alt="호담 로고"
                  />
                </div>
                <div className="absolute -inset-1 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full opacity-0 group-hover:opacity-20 blur transition-all duration-300" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                  HODAM
                </span>
                <span className="text-xs text-gray-500 hidden sm:block">
                  AI 동화 생성
                </span>
              </div>
            </Link>

            {/* 데스크톱 네비게이션 */}
            <div className="hidden lg:flex items-center space-x-1">
              {navItems.map(item => (
                <Link key={item.href} href={item.href} className="group">
                  <div
                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 ${
                      pathname === item.href ||
                      (item.href === "/my-story" &&
                        pathname?.includes("/my-story"))
                        ? "bg-orange-100 text-orange-700 shadow-sm"
                        : "text-gray-600 hover:text-orange-600 hover:bg-orange-50"
                    }`}
                  >
                    <span className="text-sm">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </div>
                </Link>
              ))}
            </div>

            {/* 우측 영역 */}
            <div className="flex items-center gap-3">
              {/* 곶감 카운터 */}
              {bead && (
                <Link href="/bead" className="group">
                  <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-orange-100 to-amber-100 rounded-full border border-orange-200 hover:border-orange-300 transition-all duration-200 hover:shadow-md">
                    <div className="relative">
                      <img
                        src="/persimmon_240424.png"
                        className="w-6 h-6 group-hover:scale-110 transition-transform duration-200"
                        alt="곶감"
                      />
                    </div>
                    <span className="text-sm font-semibold text-orange-700 min-w-[20px] text-center">
                      {bead.count}
                    </span>
                  </div>
                </Link>
              )}

              {/* 로그인/로그아웃 버튼 (데스크톱) */}
              <div className="hidden lg:block">
                {userInfo.id ? (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-full">
                      <div className="w-6 h-6 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full flex items-center justify-center">
                        <span className="text-xs text-white font-bold">
                          {userInfo.email?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm text-gray-600 max-w-[100px] truncate">
                        {userInfo.email}
                      </span>
                    </div>
                    <button
                      onClick={signOut}
                      className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-orange-600 border border-gray-200 hover:border-orange-300 rounded-full transition-all duration-200 hover:bg-orange-50"
                    >
                      로그아웃
                    </button>
                  </div>
                ) : (
                  <Link href="/sign-in">
                    <div className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-200">
                      로그인
                    </div>
                  </Link>
                )}
              </div>

              {/* 모바일 메뉴 버튼 */}
              <button
                className="lg:hidden p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
                onClick={() => setIsShowMenu(!isShowMenu)}
                aria-label="메뉴 열기"
              >
                <div className="w-6 h-6 flex flex-col justify-center items-center">
                  <div
                    className={`w-5 h-0.5 bg-gray-600 transition-all duration-300 ${
                      isShowMenu ? "rotate-45 translate-y-1.5" : ""
                    }`}
                  />
                  <div
                    className={`w-5 h-0.5 bg-gray-600 my-1 transition-all duration-300 ${
                      isShowMenu ? "opacity-0" : ""
                    }`}
                  />
                  <div
                    className={`w-5 h-0.5 bg-gray-600 transition-all duration-300 ${
                      isShowMenu ? "-rotate-45 -translate-y-1.5" : ""
                    }`}
                  />
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* 모바일 메뉴 */}
        <div
          className={`lg:hidden transition-all duration-300 ease-in-out ${
            isShowMenu
              ? "max-h-96 opacity-100"
              : "max-h-0 opacity-0 overflow-hidden"
          }`}
        >
          <div className="bg-white/95 backdrop-blur-lg border-t border-orange-100">
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-2">
              {navItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsShowMenu(false)}
                  className="block"
                >
                  <div
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      pathname === item.href ||
                      (item.href === "/my-story" &&
                        pathname?.includes("/my-story"))
                        ? "bg-orange-100 text-orange-700"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </div>
                </Link>
              ))}

              {/* 모바일 로그인/로그아웃 */}
              <div className="pt-4 border-t border-gray-100">
                {userInfo.id ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl">
                      <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full flex items-center justify-center">
                        <span className="text-sm text-white font-bold">
                          {userInfo.email?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          로그인됨
                        </p>
                        <p className="text-xs text-gray-500 truncate max-w-[200px]">
                          {userInfo.email}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        signOut();
                        setIsShowMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors duration-200"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      <span className="font-medium">로그아웃</span>
                    </button>
                  </div>
                ) : (
                  <Link
                    href="/sign-in"
                    onClick={() => setIsShowMenu(false)}
                    className="block"
                  >
                    <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                        />
                      </svg>
                      <span className="font-medium">로그인</span>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* 네비게이션 바 높이만큼 여백 추가 */}
      <div className="h-16 sm:h-20" />
    </>
  );
}

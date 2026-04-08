"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { supabase } from "@/app/utils/supabase";
import {
  shouldRedirectAfterSignIn,
  toSessionUserInfo,
} from "@/lib/auth/session-state";
import beadApi from "@/lib/client/api/bead";
import userApi from "@/lib/client/api/user";
import useBead, {
  defaultState as defaultBeadState,
} from "@/services/hooks/use-bead";
import useUserInfo, {
  defaultState as defaultUserInfoState,
} from "@/services/hooks/use-user-info";

import type { Session } from "@supabase/supabase-js";

const NAV_ITEMS = [
  { href: "/", label: "홈" },
  { href: "/service", label: "동화 만들기" },
  { href: "/my-story", label: "내 동화" },
];

export default function NavBar() {
  const { userInfo, setUserInfo, hasHydrated } = useUserInfo();
  const { bead, setBead } = useBead();
  const [isShowMenu, setIsShowMenu] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const isSignedIn = Boolean(userInfo.id);

  const applySession = useCallback(
    (session: Session | null) => {
      const sessionUserInfo = toSessionUserInfo(session);
      if (!sessionUserInfo) {
        setUserInfo(defaultUserInfoState);
        setBead(defaultBeadState);
        return;
      }

      setUserInfo(sessionUserInfo);
    },
    [setUserInfo, setBead],
  );

  async function signOut() {
    try {
      await userApi.signOut();
    } catch {
      // Ignore local sign-out error and continue clearing local state.
    }
    applySession(null);
    setIsShowMenu(false);
    router.replace("/");
    router.refresh();
  }

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!mounted) return;
        applySession(session || null);
      } catch {
        if (mounted) {
          applySession(null);
        }
      }
    };

    initializeAuth();
    return () => {
      mounted = false;
    };
  }, [applySession]);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        applySession(session || null);

        if (
          event === "SIGNED_IN" &&
          session?.user &&
          shouldRedirectAfterSignIn(pathname)
        ) {
          router.replace("/");
        }
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [applySession, pathname, router]);

  useEffect(() => {
    setIsShowMenu(false);
  }, [pathname]);

  useEffect(() => {
    const fetchBead = async () => {
      if (userInfo.id) {
        try {
          const beadInfo = await beadApi.initializeBead();
          setBead(beadInfo);
        } catch {
          setBead(defaultBeadState);
        }
      } else {
        setBead(defaultBeadState);
      }
    };

    fetchBead();
  }, [userInfo.id, setBead]);

  const signedInLabel = useMemo(() => {
    if (!userInfo.email) return "내 계정";
    return userInfo.email;
  }, [userInfo.email]);

  return (
    <>
      <nav
        className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "border-b border-[#ef8d3d]/20 bg-white/88 shadow-[0_10px_24px_rgba(181,94,23,0.12)] backdrop-blur-xl"
            : "bg-white/72 backdrop-blur"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-[#ef8d3d] to-[#f2b250] shadow-[0_10px_20px_rgba(224,128,43,0.35)] sm:h-11 sm:w-11">
              <Image
                src="/hodam.png"
                className="h-6 w-6 brightness-0 invert"
                alt="호담 로고"
                width={24}
                height={24}
              />
            </div>
            <div>
              <p className="hodam-heading text-xl leading-none text-[#aa5e1c] sm:text-2xl">
                HODAM
              </p>
              <p className="mt-0.5 hidden text-xs text-[#6b7280] sm:block">
                AI 동화 생성 서비스
              </p>
            </div>
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {NAV_ITEMS.map(item => {
              const isActive =
                pathname === item.href ||
                (item.href === "/my-story" &&
                  pathname?.startsWith("/my-story"));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-[#fff0dd] text-[#b45f1c]"
                      : "text-[#5f6670] hover:bg-[#fff6ea] hover:text-[#b45f1c]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {hasHydrated && isSignedIn && bead && (
              <Link
                href="/bead"
                className="inline-flex items-center gap-2 rounded-full border border-[#ef8d3d]/25 bg-[#fff7ec] px-2.5 py-1.5 text-xs font-bold text-[#a85e20] transition hover:border-[#ef8d3d]/40"
              >
                <Image
                  src="/persimmon_240424.png"
                  className="h-5 w-5"
                  alt="곶감"
                  width={20}
                  height={20}
                />
                {bead.count}
              </Link>
            )}

            <div className="hidden lg:block">
              {!hasHydrated && (
                <div className="h-10 w-24 animate-pulse rounded-full bg-gray-200" />
              )}

              {hasHydrated && isSignedIn && (
                <div className="flex items-center gap-2">
                  <Link
                    href="/profile"
                    className="max-w-[160px] truncate rounded-full border border-[#ef8d3d]/20 bg-white px-4 py-2 text-sm font-semibold text-[#5f6670]"
                    title={signedInLabel}
                  >
                    {signedInLabel}
                  </Link>
                  <button
                    type="button"
                    onClick={signOut}
                    className="rounded-full border border-[#ef8d3d]/25 px-4 py-2 text-sm font-semibold text-[#9b5418] transition hover:bg-[#fff5e8]"
                  >
                    로그아웃
                  </button>
                </div>
              )}

              {hasHydrated && !isSignedIn && (
                <Link href="/sign-in" className="hodam-primary-button text-sm">
                  로그인
                </Link>
              )}
            </div>

            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ef8d3d]/20 bg-white/80 lg:hidden"
              onClick={() => setIsShowMenu(prev => !prev)}
              aria-label="메뉴 열기"
            >
              <svg
                className="h-5 w-5 text-[#9b5418]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d={
                    isShowMenu
                      ? "M6 18L18 6M6 6l12 12"
                      : "M4 7h16M4 12h16M4 17h16"
                  }
                />
              </svg>
            </button>
          </div>
        </div>

        <div
          className={`overflow-hidden border-t border-[#ef8d3d]/15 bg-white/96 transition-all duration-300 lg:hidden ${
            isShowMenu ? "max-h-[420px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="space-y-2 px-4 py-4">
            {NAV_ITEMS.map(item => {
              const isActive =
                pathname === item.href ||
                (item.href === "/my-story" &&
                  pathname?.startsWith("/my-story"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    isActive
                      ? "bg-[#fff0dd] text-[#b45f1c]"
                      : "text-[#5f6670] hover:bg-[#fff6ea]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            <div className="border-t border-[#ef8d3d]/15 pt-3">
              {!hasHydrated && (
                <div className="h-11 w-full animate-pulse rounded-xl bg-gray-200" />
              )}

              {hasHydrated && isSignedIn && (
                <div className="space-y-2">
                  <Link
                    href="/profile"
                    className="block rounded-xl border border-[#ef8d3d]/15 bg-[#fffaf3] px-4 py-3 text-sm font-semibold text-[#4b5563]"
                  >
                    내 계정
                  </Link>
                  <button
                    type="button"
                    onClick={signOut}
                    className="w-full rounded-xl border border-[#f0c3a2] px-4 py-3 text-left text-sm font-semibold text-[#9b5418]"
                  >
                    로그아웃
                  </button>
                </div>
              )}

              {hasHydrated && !isSignedIn && (
                <Link
                  href="/sign-in"
                  className="block rounded-xl bg-gradient-to-r from-[#ef8d3d] to-[#f2b250] px-4 py-3 text-center text-sm font-bold text-white"
                >
                  로그인
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="h-16 sm:h-20" />
    </>
  );
}

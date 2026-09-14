"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import beadApi from "@/app/api/bead";
import userApi from "@/app/api/user";
import { supabase } from "@/app/utils/supabase";
import useBead, {
  defaultState as defaultBead,
} from "@/services/hooks/use-bead";
import useUserInfo, { defaultState } from "@/services/hooks/use-user-info";

const navItems = [
  { href: "/service", label: "그림책 만들기" },
  { href: "/sample", label: "그림책 미리보기" },
  { href: "/my-story", label: "내 책장" },
];

export default function NavBar() {
  const { userInfo, setUserInfo, isAuthReady, setAuthReady } = useUserInfo();
  const { bead, setBead } = useBead();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const menuButton = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const [returnPath, setReturnPath] = useState(pathname);
  const router = useRouter();

  useEffect(() => {
    // Keep auth callbacks synchronous; awaiting Supabase here can deadlock.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setUserInfo(
        user
          ? {
              id: user.id,
              email: user.email,
              profileUrl: user.user_metadata?.avatar_url || "",
            }
          : defaultState,
      );
      if (!user) setBead(defaultBead);
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, [setUserInfo, setBead, setAuthReady]);

  useEffect(() => {
    let active = true;
    setBead(defaultBead);
    if (userInfo.id)
      beadApi
        .initializeBead(userInfo.id)
        .then(value => {
          if (active) setBead(value);
        })
        .catch(() => {
          /* Creation retries a balance that could not be loaded. */
        });
    return () => {
      active = false;
    };
  }, [userInfo.id, setBead]);

  useEffect(() => {
    setOpen(false);
    setReturnPath(`${pathname}${window.location.search}`);
  }, [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  async function signOut() {
    try {
      await userApi.signOut();
      setOpen(false);
      router.replace("/");
    } catch {
      setError("로그아웃하지 못했어요. 다시 시도해주세요.");
    }
  }
  const signInHref = `/sign-in?next=${encodeURIComponent(pathname === "/" ? "/service" : returnPath)}`;
  return (
    <header className="site-header">
      <nav className="site-nav" aria-label="주 메뉴">
        <Link href="/" className="wordmark" aria-label="호담 홈">
          <span>호담</span>
          <small>오늘을 담은 그림책</small>
        </Link>
        <div className="desktop-nav">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname.startsWith(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="nav-actions">
          {isAuthReady && userInfo.id && (
            <Link
              href="/bead"
              className="balance-link"
              aria-label={`보유 곶감 ${bead.count ?? "확인 중"}`}
            >
              <img src="/persimmon_240424.png" alt="" width="24" height="24" />
              <span>{bead.count ?? "…"}</span>
            </Link>
          )}
          <Link
            className="nav-account"
            href={userInfo.id ? "/profile" : signInHref}
          >
            {userInfo.id ? "내 프로필" : "로그인"}
          </Link>
          <button
            ref={menuButton}
            type="button"
            className="menu-toggle"
            aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen(!open)}
          >
            {open ? "닫기" : "메뉴"}
          </button>
        </div>
      </nav>
      {open && (
        <nav id="mobile-nav" className="mobile-nav" aria-label="모바일 메뉴">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname.startsWith(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
          {userInfo.id && (
            <button type="button" onClick={signOut}>
              로그아웃
            </button>
          )}
        </nav>
      )}
      {error && (
        <p role="alert" className="notice-error">
          {error}
        </p>
      )}
    </header>
  );
}

import Link from "next/link";

import { resolveNavMobileAuthMode } from "@/app/components/navigation/nav-mobile-auth-view";
import { getNavUserInitial } from "@/app/components/navigation/nav-mobile-menu-view";

interface NavMobileAuthSectionProps {
  hasHydrated: boolean;
  userId: string | undefined;
  userEmail: string | undefined;
  onCloseMenu: () => void;
  onSignOut: () => void;
}

export default function NavMobileAuthSection({
  hasHydrated,
  userId,
  userEmail,
  onCloseMenu,
  onSignOut,
}: NavMobileAuthSectionProps) {
  const mode = resolveNavMobileAuthMode({
    hasHydrated,
    userId,
  });

  if (mode === "loading") {
    return <div className="h-11 w-full animate-pulse rounded-xl bg-gray-200" />;
  }

  if (mode === "authenticated") {
    return (
      <div className="space-y-3">
        <Link href="/profile" onClick={onCloseMenu} className="block">
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-200">
            <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full flex items-center justify-center">
              <span className="text-sm text-white font-bold">
                {getNavUserInitial(userEmail)}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">내 프로필</p>
              <p className="text-xs text-gray-500 truncate max-w-[200px]">
                {userEmail}
              </p>
            </div>
            <div className="ml-auto">
              <svg
                className="w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </div>
        </Link>

        <button
          type="button"
          onClick={onSignOut}
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
    );
  }

  return (
    <Link href="/sign-in" onClick={onCloseMenu} className="block">
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
  );
}

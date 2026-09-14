import Link from "next/link";

interface NavAuthActionsProps {
  hasHydrated: boolean;
  userId: string | undefined;
  userEmail: string | undefined;
  onSignOut: () => void;
}

export default function NavAuthActions({
  hasHydrated,
  userId,
  userEmail,
  onSignOut,
}: NavAuthActionsProps) {
  return (
    <div className="hidden lg:block">
      {!hasHydrated && (
        <div className="h-10 w-24 animate-pulse rounded-full bg-gray-200" />
      )}
      {hasHydrated && userId && (
        <div className="flex items-center gap-3">
          <Link href="/profile" className="group">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors duration-200">
              <div className="w-6 h-6 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full flex items-center justify-center">
                <span className="text-xs text-white font-bold">
                  {userEmail?.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm text-gray-600 max-w-[100px] truncate group-hover:text-gray-800">
                {userEmail}
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={onSignOut}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-orange-600 border border-gray-200 hover:border-orange-300 rounded-full transition-all duration-200 hover:bg-orange-50"
          >
            로그아웃
          </button>
        </div>
      )}
      {hasHydrated && !userId && (
        <Link href="/sign-in">
          <div className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-200">
            로그인
          </div>
        </Link>
      )}
    </div>
  );
}

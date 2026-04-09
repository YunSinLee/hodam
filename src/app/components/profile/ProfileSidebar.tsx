import Image from "next/image";

import type {
  ProfileFormatters,
  ProfileSidebarHandlers,
  ProfileSidebarState,
} from "@/app/profile/profile-page-contract";

interface ProfileSidebarProps {
  state: ProfileSidebarState;
  handlers: ProfileSidebarHandlers;
  formatters: Pick<ProfileFormatters, "formatDate">;
}

export default function ProfileSidebar({
  state,
  handlers,
  formatters,
}: ProfileSidebarProps) {
  const {
    profile,
    stats,
    beadCount,
    isEditingNickname,
    newNickname,
    isUpdatingNickname,
  } = state;
  const {
    onOpenImageOptions,
    onStartNicknameEdit,
    onNicknameInputChange,
    onSubmitNicknameUpdate,
    onCancelNicknameEdit,
    onGoBead,
    onLogout,
  } = handlers;
  const { formatDate } = formatters;

  return (
    <aside className="space-y-4 sm:space-y-6 lg:col-span-1">
      <section className="rounded-2xl bg-white p-5 shadow-lg sm:p-6">
        <div className="text-center">
          <div className="relative mx-auto mb-4 h-24 w-24">
            <button
              type="button"
              className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-r from-orange-400 to-amber-400 transition-opacity hover:opacity-80"
              onClick={onOpenImageOptions}
              title="프로필 이미지 변경"
            >
              {profile.profileUrl ? (
                <Image
                  src={profile.profileUrl}
                  alt="프로필"
                  className="h-24 w-24 rounded-full object-cover"
                  width={96}
                  height={96}
                />
              ) : (
                <span className="text-2xl font-bold text-white">
                  {profile.display_name?.charAt(0).toUpperCase() ||
                    profile.email.charAt(0).toUpperCase()}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenImageOptions}
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-orange-600 text-white shadow-lg transition-colors hover:bg-orange-700"
              title="프로필 이미지 변경"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>

          <div className="mb-2">
            {isEditingNickname ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={newNickname}
                  onChange={onNicknameInputChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="닉네임을 입력하세요"
                  maxLength={20}
                />
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={onSubmitNicknameUpdate}
                    disabled={isUpdatingNickname || !newNickname.trim()}
                    className="rounded-lg bg-orange-600 px-3 py-1 text-sm text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                  >
                    {isUpdatingNickname ? "저장 중..." : "저장"}
                  </button>
                  <button
                    type="button"
                    onClick={onCancelNicknameEdit}
                    disabled={isUpdatingNickname}
                    className="rounded-lg bg-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-xl font-bold text-gray-800">
                  {profile.display_name || "닉네임 없음"}
                </h2>
                <button
                  type="button"
                  onClick={onStartNicknameEdit}
                  className="p-1 text-gray-400 transition-colors hover:text-orange-600"
                  title="닉네임 편집"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>

          <p className="mb-4 text-sm text-gray-600">{profile.email}</p>
          <p className="text-xs text-gray-500">
            가입일: {formatDate(profile.created_at)}
          </p>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-lg sm:p-6">
        <h3 className="mb-4 flex items-center text-lg font-bold text-gray-800">
          <span className="mr-2 text-2xl">🍯</span>
          곶감 현황
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">보유 곶감</span>
            <span className="text-xl font-bold text-orange-600">
              {beadCount}개
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">총 구매</span>
            <span className="font-semibold text-gray-800">
              {stats?.totalBeadsPurchased || 0}개
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">총 사용</span>
            <span className="font-semibold text-gray-800">
              {stats?.totalBeadsUsed || 0}개
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onGoBead}
          className="mt-4 w-full rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-white transition-all hover:from-orange-600 hover:to-amber-600"
        >
          곶감 충전하기
        </button>
      </section>

      <button
        type="button"
        onClick={onLogout}
        className="w-full rounded-lg bg-gray-100 px-4 py-3 text-gray-700 transition-colors hover:bg-gray-200"
      >
        로그아웃
      </button>
    </aside>
  );
}

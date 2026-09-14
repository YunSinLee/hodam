import { toPercentText } from "@/lib/ui/profile-metrics";

import ProfileSectionCard from "./ProfileSectionCard";

interface ProfileKpiPanelProps {
  kpiWarningMessage: string | null;
  latestCostPerStory: number;
  latestAuthCallbackSuccess: number;
  latestAuthCallbackError: number;
  latestAuthCallbackSuccessGoogle: number;
  latestAuthCallbackSuccessKakao: number;
  latestAuthCallbackErrorGoogle: number;
  latestAuthCallbackErrorKakao: number;
  latestD1Retention: number;
  latestD7Retention: number;
  retainedD1: boolean;
  retainedD7: boolean;
}

export default function ProfileKpiPanel({
  kpiWarningMessage,
  latestCostPerStory,
  latestAuthCallbackSuccess,
  latestAuthCallbackError,
  latestAuthCallbackSuccessGoogle,
  latestAuthCallbackSuccessKakao,
  latestAuthCallbackErrorGoogle,
  latestAuthCallbackErrorKakao,
  latestD1Retention,
  latestD7Retention,
  retainedD1,
  retainedD7,
}: ProfileKpiPanelProps) {
  const authCallbackTotal = latestAuthCallbackSuccess + latestAuthCallbackError;
  const authCallbackErrorRate =
    authCallbackTotal > 0
      ? Math.round((latestAuthCallbackError / authCallbackTotal) * 100)
      : 0;

  return (
    <ProfileSectionCard
      title="운영 KPI (최근 14일)"
      subtitle="create/retention/cost"
    >
      {kpiWarningMessage && (
        <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
          {kpiWarningMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
          <div className="mb-1 text-xs text-orange-700">
            동화당 평균 AI 비용
          </div>
          <div className="text-xl font-bold text-orange-800">
            {latestCostPerStory.toFixed(2)}
          </div>
          <div className="mt-1 text-[11px] text-orange-600">cost_per_story</div>
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="mb-1 text-xs text-blue-700">전체 D1 리텐션</div>
          <div className="text-xl font-bold text-blue-800">
            {toPercentText(latestD1Retention)}
          </div>
          <div className="mt-1 text-[11px] text-blue-600">cohort-based</div>
        </div>

        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
          <div className="mb-1 text-xs text-indigo-700">전체 D7 리텐션</div>
          <div className="text-xl font-bold text-indigo-800">
            {toPercentText(latestD7Retention)}
          </div>
          <div className="mt-1 text-[11px] text-indigo-600">cohort-based</div>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="mb-1 text-xs text-emerald-700">내 리텐션 상태</div>
          <div className="text-sm font-semibold text-emerald-800">
            D1: {retainedD1 ? "달성" : "미달성"}
          </div>
          <div className="mt-1 text-sm font-semibold text-emerald-800">
            D7: {retainedD7 ? "달성" : "미달성"}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-rose-700">
          <span className="font-semibold">로그인 콜백 진단(일별)</span>
          <span>성공 {latestAuthCallbackSuccess}</span>
          <span>오류 {latestAuthCallbackError}</span>
          <span>오류율 {authCallbackErrorRate}%</span>
          <span>
            Google 성공/오류 {latestAuthCallbackSuccessGoogle}/
            {latestAuthCallbackErrorGoogle}
          </span>
          <span>
            Kakao 성공/오류 {latestAuthCallbackSuccessKakao}/
            {latestAuthCallbackErrorKakao}
          </span>
        </div>
      </div>
    </ProfileSectionCard>
  );
}

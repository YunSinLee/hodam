import type { MyStoryDetailDiagnosticsBannerProps } from "@/app/components/my-story-detail/my-story-detail-contract";

export default function MyStoryDetailDiagnosticsBanner({
  diagnostics,
}: MyStoryDetailDiagnosticsBannerProps) {
  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      동화 상세를 예비 경로로 불러왔어요
      {` (source=${diagnostics.source}, reasons=${
        diagnostics.reasons.length > 0
          ? diagnostics.reasons.join(",")
          : "unknown"
      }).`}
      {" 일부 정보 반영이 지연될 수 있습니다."}
    </div>
  );
}

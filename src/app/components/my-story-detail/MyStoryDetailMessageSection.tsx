import MessageDisplay from "@/app/components/MessageDisplay";
import type { MyStoryDetailMessageSectionProps } from "@/app/components/my-story-detail/my-story-detail-contract";

export default function MyStoryDetailMessageSection({
  messages,
  ableEnglish,
  isShowEnglish,
}: MyStoryDetailMessageSectionProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-orange-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            동화 내용
          </h2>

          {ableEnglish && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">언어:</span>
              <div className="flex items-center gap-1">
                <span
                  className={`rounded-full px-2 py-1 text-xs ${!isShowEnglish ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}
                >
                  한국어
                </span>
                {isShowEnglish && (
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">
                    + 영어
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <MessageDisplay
          messages={messages}
          isShowEnglish={isShowEnglish}
          useGoogleTTS={false}
          voice="female"
        />
      </div>
    </section>
  );
}

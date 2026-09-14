import type { RecentStory } from "@/lib/client/api/profile";

import ProfileSectionCard from "./ProfileSectionCard";

interface ProfileRecentStoriesPanelProps {
  recentStories: RecentStory[];
  formatDate: (dateString: string) => string;
  onGoMyStory: () => void;
  onOpenStoryDetail: (storyId: number) => void;
  onGoService: () => void;
}

export default function ProfileRecentStoriesPanel({
  recentStories,
  formatDate,
  onGoMyStory,
  onOpenStoryDetail,
  onGoService,
}: ProfileRecentStoriesPanelProps) {
  return (
    <ProfileSectionCard
      title="최근 생성한 동화"
      actionLabel="전체보기 →"
      onAction={onGoMyStory}
    >
      {recentStories.length > 0 ? (
        <div className="space-y-3">
          {recentStories.map(story => (
            <button
              type="button"
              key={story.id}
              className="flex w-full items-center justify-between rounded-lg bg-gray-50 p-3 text-left transition-colors hover:bg-gray-100"
              onClick={() => onOpenStoryDetail(story.id)}
            >
              <div>
                <h4 className="font-semibold text-gray-800">
                  {story.keywords && story.keywords.length > 0
                    ? story.keywords
                        .map((k: { keyword: string }) => k.keyword)
                        .join(", ")
                    : `동화 #${String(story.id).slice(-6)}`}
                </h4>
                <p className="text-sm text-gray-600">
                  {formatDate(story.created_at)}
                </p>
              </div>
              <span className="text-gray-400">→</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center text-gray-500">
          <div className="mb-2 text-4xl">📖</div>
          <p>아직 생성한 동화가 없습니다.</p>
          <button
            type="button"
            onClick={onGoService}
            className="mt-2 text-orange-600 hover:text-orange-700"
          >
            첫 동화 만들기 →
          </button>
        </div>
      )}
    </ProfileSectionCard>
  );
}

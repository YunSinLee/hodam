import type { MyStoryDetailMessage } from "@/app/components/my-story-detail/my-story-detail-contract";
import MyStoryDetailEmptyState from "@/app/components/my-story-detail/MyStoryDetailEmptyState";
import MyStoryDetailImageSection from "@/app/components/my-story-detail/MyStoryDetailImageSection";
import MyStoryDetailLoadingState from "@/app/components/my-story-detail/MyStoryDetailLoadingState";
import MyStoryDetailMessageSection from "@/app/components/my-story-detail/MyStoryDetailMessageSection";

interface MyStoryDetailContentProps {
  isLoading: boolean;
  imageUrl: string | null;
  messages: MyStoryDetailMessage[];
  ableEnglish: boolean;
  isShowEnglish: boolean;
  errorMessage: string | null;
  onRetry: () => void;
}

export default function MyStoryDetailContent({
  isLoading,
  imageUrl,
  messages,
  ableEnglish,
  isShowEnglish,
  errorMessage,
  onRetry,
}: MyStoryDetailContentProps) {
  if (isLoading) {
    return <MyStoryDetailLoadingState />;
  }

  if (messages.length === 0) {
    return (
      <MyStoryDetailEmptyState errorMessage={errorMessage} onRetry={onRetry} />
    );
  }

  return (
    <div className="space-y-8">
      {imageUrl && <MyStoryDetailImageSection imageUrl={imageUrl} />}
      <MyStoryDetailMessageSection
        messages={messages}
        ableEnglish={ableEnglish}
        isShowEnglish={isShowEnglish}
      />
    </div>
  );
}

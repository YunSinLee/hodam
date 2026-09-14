import Image from "next/image";

import {
  getStoryImageAltText,
  shouldRenderStoryImageLoading,
  shouldRenderStoryImagePanel,
} from "@/app/components/story/story-image-view";
import type { StoryImagePanelState } from "@/app/components/story/story-session-contract";

interface StoryImagePanelProps {
  state: StoryImagePanelState;
}

export default function StoryImagePanel({ state }: StoryImagePanelProps) {
  if (!shouldRenderStoryImagePanel(state)) {
    return null;
  }

  const { images } = state;
  const showImageLoading = shouldRenderStoryImageLoading(state);

  return (
    <section className="mb-4">
      <h2 className="mb-2 text-lg font-semibold text-gray-800 sm:text-xl">
        동화 이미지
      </h2>

      <div className="grid grid-cols-1 gap-2">
        {images.map((src, index) => (
          <Image
            key={src}
            src={src}
            className="w-full rounded-md"
            alt={getStoryImageAltText(index)}
            width={1024}
            height={1024}
            unoptimized
          />
        ))}

        {showImageLoading && (
          <div className="relative w-full rounded-md bg-gray-100 pb-[100%]">
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
              <p className="mt-2 text-sm text-blue-600 sm:text-base">
                이미지 생성 중...
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

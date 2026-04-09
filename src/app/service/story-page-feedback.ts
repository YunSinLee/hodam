import type { StoryPageFeedback } from "@/app/service/story-page-contract";
import type { StoryPageGuardFailure } from "@/app/service/story-page-guards";
import { resolveStoryServiceFeedback } from "@/lib/ui/story-service-error";

export function toStoryGuardFailureFeedback(
  guard: StoryPageGuardFailure,
): StoryPageFeedback {
  return {
    type: "error",
    message: guard.message,
    action: guard.action || null,
  };
}

export function toStoryRequestErrorFeedback(error: unknown): StoryPageFeedback {
  const feedback = resolveStoryServiceFeedback(error);
  return {
    type: "error",
    message: feedback.message,
    action: feedback.action,
  };
}

export function canRequestStoryContinue(params: {
  isStoryLoading: boolean;
  isSelectionLoading: boolean;
}): boolean {
  return !params.isStoryLoading && !params.isSelectionLoading;
}

export function canRequestStoryTranslate(params: {
  isStarted: boolean;
  messageCount: number;
  threadId: number | null;
}): boolean {
  return (
    params.isStarted && params.messageCount > 0 && Boolean(params.threadId)
  );
}

import {
  isThreadListUnavailable,
  type ThreadListWithDiagnostics,
} from "@/lib/client/api/thread";

export interface MyStoryThreadListFeedback {
  errorMessage: string | null;
  warningMessage: string | null;
}

const THREAD_LIST_UNAVAILABLE_MESSAGE =
  "동화 목록을 불러오는 중 일시적인 서버 문제가 발생했습니다. 잠시 후 다시 시도해주세요.";
const THREAD_LIST_DEGRADED_BASE_MESSAGE =
  "동화 목록 조회가 지연되어 보조 경로로 처리되었습니다.";
export function resolveMyStoryThreadListFeedback(
  input: ThreadListWithDiagnostics,
  options: { isDevelopment: boolean },
): MyStoryThreadListFeedback {
  const { diagnostics } = input;
  const { isDevelopment } = options;

  if (isThreadListUnavailable(input)) {
    return {
      errorMessage: THREAD_LIST_UNAVAILABLE_MESSAGE,
      warningMessage: null,
    };
  }

  if (!diagnostics.degraded) {
    return {
      errorMessage: null,
      warningMessage: null,
    };
  }

  const reasonText = diagnostics.reasons.join(", ");
  const debugSuffix = isDevelopment
    ? ` (source=${diagnostics.source}${
        reasonText ? `, reasons=${reasonText}` : ""
      })`
    : "";

  return {
    errorMessage: null,
    warningMessage: `${THREAD_LIST_DEGRADED_BASE_MESSAGE}${debugSuffix}`,
  };
}

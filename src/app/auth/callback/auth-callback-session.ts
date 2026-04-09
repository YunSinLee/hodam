import { wait, withTimeout } from "@/app/auth/callback/auth-callback-timeout";

export interface CallbackSession {
  user?: unknown;
  [key: string]: unknown;
}

export interface CallbackAuthResponse<TSession = CallbackSession> {
  data?: {
    session?: TSession | null;
  } | null;
  error?: {
    message?: string;
  } | null;
}

export interface CallbackAuthClient<TSession = CallbackSession> {
  getSession: () => Promise<CallbackAuthResponse<TSession>>;
  exchangeCodeForSession: (
    code: string,
  ) => Promise<CallbackAuthResponse<TSession>>;
}

export interface WaitForSessionOptions {
  retries?: number;
  waitMs?: number;
  timeoutMs: number;
}

export async function waitForAuthSession<TSession = CallbackSession>(
  authClient: Pick<CallbackAuthClient<TSession>, "getSession">,
  options: WaitForSessionOptions,
): Promise<TSession | null> {
  const retries =
    Number.isFinite(options.retries) && Number(options.retries) > 0
      ? Math.floor(Number(options.retries))
      : 10;
  const waitMs =
    Number.isFinite(options.waitMs) && Number(options.waitMs) >= 0
      ? Number(options.waitMs)
      : 350;

  const attemptLookup = async (attempt: number): Promise<TSession | null> => {
    const { data } = await withTimeout(
      authClient.getSession(),
      options.timeoutMs,
      "getSession",
    );

    const currentSession = data?.session || null;
    if (currentSession) {
      return currentSession;
    }

    if (attempt >= retries - 1) {
      return null;
    }

    if (waitMs > 0) {
      await wait(waitMs);
    }

    return attemptLookup(attempt + 1);
  };

  return attemptLookup(0);
}

export interface ExchangeCodeWithFallbackParams<TSession = CallbackSession> {
  authClient: Pick<CallbackAuthClient<TSession>, "exchangeCodeForSession">;
  code: string;
  timeoutMs: number;
  markCodeInFlight: (code: string) => void;
  clearCodeMarker: (code: string) => void;
  setLoadingMessage: (message: string) => void;
  waitForSession: (
    retries?: number,
    waitMs?: number,
  ) => Promise<TSession | null>;
  isTerminalError: (errorMessage: string | null) => boolean;
}

export interface ExchangeCodeWithFallbackResult<TSession = CallbackSession> {
  session: TSession | null;
  errorMessage: string | null;
  terminal: boolean;
}

export async function exchangeCodeWithSessionFallback<
  TSession = CallbackSession,
>(
  params: ExchangeCodeWithFallbackParams<TSession>,
): Promise<ExchangeCodeWithFallbackResult<TSession>> {
  const {
    authClient,
    code,
    timeoutMs,
    markCodeInFlight,
    clearCodeMarker,
    setLoadingMessage,
    waitForSession,
    isTerminalError,
  } = params;

  markCodeInFlight(code);
  setLoadingMessage("로그인 코드를 교환하는 중...");

  const { data: exchangeData, error: exchangeError } = await withTimeout(
    authClient.exchangeCodeForSession(code),
    timeoutMs,
    "exchangeCodeForSession",
  );

  const exchangeErrorMessage =
    typeof exchangeError?.message === "string" ? exchangeError.message : null;

  if (exchangeErrorMessage && isTerminalError(exchangeErrorMessage)) {
    clearCodeMarker(code);
    return {
      session: null,
      errorMessage: exchangeErrorMessage,
      terminal: true,
    };
  }

  if (exchangeErrorMessage) {
    clearCodeMarker(code);
  }

  setLoadingMessage("세션을 동기화하는 중...");
  const syncedSession =
    exchangeData?.session || (await waitForSession(10, 400));
  if (!syncedSession) {
    clearCodeMarker(code);
  }

  return {
    session: syncedSession,
    errorMessage: exchangeErrorMessage,
    terminal: false,
  };
}

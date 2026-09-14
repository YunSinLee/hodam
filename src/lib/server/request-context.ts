import { fail as baseFail, ok as baseOk } from "@/lib/server/api-response";
import { resolveRequestId } from "@/lib/server/request-id";

interface RequestLike {
  headers: Pick<Headers, "get">;
}

interface ResponseInitLike extends Omit<ResponseInit, "status"> {}

export function createApiRequestContext(request: RequestLike) {
  const requestId = resolveRequestId(request.headers);

  const fail = (
    status: number,
    error: string,
    extra?: Record<string, unknown>,
    init?: ResponseInitLike,
  ) =>
    baseFail(status, error, extra, {
      ...(init || {}),
      requestId,
    });

  const failWithCode = (
    status: number,
    error: string,
    code: string,
    extra?: Record<string, unknown>,
    init?: ResponseInitLike,
  ) =>
    baseFail(
      status,
      error,
      {
        code,
        ...(extra || {}),
      },
      {
        ...(init || {}),
        requestId,
      },
    );

  const ok = <T>(data: T, init?: ResponseInitLike) =>
    baseOk(data, {
      ...(init || {}),
      requestId,
    });

  return {
    requestId,
    fail,
    failWithCode,
    ok,
  };
}

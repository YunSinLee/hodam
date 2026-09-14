import { useCallback, useEffect, useRef, useState } from "react";

import { drawPicturebookPageAction } from "@/app/api/story-actions";
import type { PicturebookPage } from "@/app/types/openai";
import { requireAccessToken } from "@/app/utils/session";

import useUserInfo from "./use-user-info";

export default function usePicturebookImages() {
  const [urls, setUrls] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [progress, setProgress] = useState({
    completed: 0,
    total: 0,
    failed: 0,
  });
  const queue = useRef(Promise.resolve());
  const epoch = useRef(0);
  const mounted = useRef(true);
  const pending = useRef(new Set<string>());
  const knownUrls = useRef<Record<number, string>>({});
  const blocked = useRef(false);
  const reset = useCallback((initial: Record<number, string> = {}) => {
    epoch.current += 1;
    pending.current.clear();
    knownUrls.current = initial;
    queue.current = Promise.resolve();
    blocked.current = false;
    if (!mounted.current) return;
    setUrls(initial);
    setError("");
    setProgress({ completed: 0, total: 0, failed: 0 });
  }, []);
  const invalidate = useCallback((pageNumber: number) => {
    if (!knownUrls.current[pageNumber]) return;
    const nextUrls = { ...knownUrls.current };
    delete nextUrls[pageNumber];
    knownUrls.current = nextUrls;
    setUrls(nextUrls);
    setError("저장된 그림을 열지 못했어요. 빠진 그림을 다시 요청해주세요.");
    setProgress(value => ({ ...value, failed: value.failed + 1 }));
  }, []);
  useEffect(() => {
    mounted.current = true;
    const pendingPages = pending.current;
    return () => {
      mounted.current = false;
      epoch.current += 1;
      pendingPages.clear();
    };
  }, []);
  const draw = useCallback((threadId: number, pages: PicturebookPage[]) => {
    if (!mounted.current) return;
    const currentEpoch = epoch.current;
    const owner = useUserInfo.getState().userInfo.id;
    const isCurrent = () =>
      mounted.current &&
      epoch.current === currentEpoch &&
      useUserInfo.getState().userInfo.id === owner;
    const wasIdle = pending.current.size === 0;
    const requestedPages = pages.filter(page => {
      const key = `${threadId}:${page.pageNumber}`;
      if (pending.current.has(key) || knownUrls.current[page.pageNumber])
        return false;
      pending.current.add(key);
      return true;
    });
    if (!requestedPages.length) return;
    if (wasIdle) {
      blocked.current = false;
      setError("");
    }
    setProgress(value =>
      wasIdle
        ? { completed: 0, total: requestedPages.length, failed: 0 }
        : { ...value, total: value.total + requestedPages.length },
    );
    queue.current = queue.current
      .then(async () => {
        // Generate one page at a time so auth changes and quota failures stop
        // subsequent requests before they can spend credits.
        /* eslint-disable no-restricted-syntax, no-await-in-loop, no-continue */
        for (const page of requestedPages) {
          if (!isCurrent()) return;
          let failed = false;
          try {
            if (blocked.current) {
              failed = true;
              continue;
            }
            const token = await requireAccessToken();
            if (!isCurrent()) return;
            const result = await drawPicturebookPageAction(
              threadId,
              page.pageNumber,
              token,
            );
            if (!isCurrent()) return;
            if (!result.ok) {
              failed = true;
              setError(result.message);
              blocked.current = !result.retryable;
              continue;
            }
            const { url } = result;
            knownUrls.current = {
              ...knownUrls.current,
              [page.pageNumber]: url,
            };
            setUrls(value => ({ ...value, [page.pageNumber]: url }));
          } catch {
            failed = true;
            if (isCurrent())
              setError(
                "그림 요청 결과를 확인하지 못했어요. 잠시 후 다시 요청해주세요.",
              );
          } finally {
            if (isCurrent()) {
              pending.current.delete(`${threadId}:${page.pageNumber}`);
              setProgress(value => ({
                ...value,
                completed: value.completed + 1,
                failed: value.failed + (failed ? 1 : 0),
              }));
            }
          }
        }
        /* eslint-enable no-restricted-syntax, no-await-in-loop, no-continue */
      })
      .catch(() => {
        /* Each page already records its failure. */
      });
  }, []);
  return {
    urls,
    error,
    progress,
    reset,
    invalidate,
    draw,
    isLoading: progress.total > progress.completed,
  };
}

"use server";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  generatePicturebookEnding,
  generatePicturebookPageImage,
  generatePicturebookStart,
} from "./langchain";
import { requireServerUser } from "./server-auth";
import {
  parsePicturebookDraft,
  validatePicturebookInput,
} from "../utils/picturebook";

import type {
  PicturebookChoiceOption,
  PicturebookDraft,
  PicturebookInput,
} from "../types/openai";

type CreateResult =
  | { ok: true; book: PicturebookDraft; threadId: number; beadCount: number }
  | {
      ok: false;
      message: string;
      retrySameRequest?: boolean;
      retryable?: boolean;
    };
type FinishResult =
  | { ok: true; book: PicturebookDraft }
  | { ok: false; message: string; retryable: boolean };
type DrawResult =
  | { ok: true; url: string }
  | { ok: false; message: string; retryable: boolean };
const creating = new Map<string, Promise<CreateResult>>();
const finishing = new Map<string, Promise<FinishResult>>();
const drawing = new Map<string, Promise<DrawResult>>();

function failure(cause: unknown, fallback: string) {
  return {
    ok: false as const,
    message: cause instanceof Error ? cause.message : fallback,
    retryable: !(
      cause instanceof Error &&
      "retryable" in cause &&
      cause.retryable === false
    ),
  };
}

function beadCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new Error(
      "곶감 정보를 확인하지 못했어요. 잠시 후 다시 시도해주세요.",
    );
  return value;
}

const commitErrors: Record<string, string> = {
  PICTUREBOOK_REQUEST_UNRESOLVED:
    "이전 생성 요청의 저장 상태를 확인해야 해요. 내 책장을 확인하고 운영팀에 문의해주세요.",
  INSUFFICIENT_BEADS: "곶감이 부족해요. 보유 곶감을 확인해주세요.",
  BEAD_BALANCE_UNAVAILABLE:
    "곶감 정보를 확인하지 못했어요. 다시 로그인해주세요.",
  INVALID_PICTUREBOOK_REQUEST:
    "그림책 저장 요청을 확인하지 못했어요. 운영팀에 문의해주세요.",
  FORBIDDEN: "그림책 저장 서비스에 연결할 수 없어요. 운영팀에 문의해주세요.",
};

function knownCommitError(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("message" in error))
    return undefined;
  return typeof error.message === "string" &&
    Object.hasOwn(commitErrors, error.message)
    ? commitErrors[error.message]
    : undefined;
}

function picturebookCommitError(error: unknown) {
  const knownMessage = knownCommitError(error);
  return Object.assign(
    new Error(
      knownMessage ||
        "그림책 저장 결과를 확인하지 못했어요. 내 책장을 확인하거나 같은 요청을 다시 확인해주세요.",
    ),
    { retryable: !knownMessage },
  );
}

function imageIsMissing(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const detail = error as {
    code?: string;
    statusCode?: string;
    message?: string;
  };
  // Signing failures such as an expired session or an outage are not cache misses.
  return (
    detail.code === "NoSuchKey" ||
    detail.statusCode === "NoSuchKey" ||
    /^(?:object not found|the resource was not found)$/i.test(
      detail.message || "",
    )
  );
}

function decodePageImage(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > 28_000_000 ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  )
    throw new Error("그림 응답을 확인하지 못했어요. 다시 시도해주세요.");
  const image = Buffer.from(value, "base64");
  if (
    !image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    throw new Error("그림 응답을 확인하지 못했어요. 다시 시도해주세요.");
  return image;
}

async function quota(
  client: Awaited<ReturnType<typeof requireServerUser>>["client"],
  userId: string,
  kind: "start" | "ending" | "image",
) {
  const { data, error } = await client.rpc("consume_daily_quota", {
    p_user_id: userId,
    p_action: `picturebook_${kind}`,
    p_cost: 1,
    p_daily_limit: kind === "image" ? 160 : 20,
  });
  if (error)
    throw new Error(
      "생성 가능 여부를 확인하지 못했어요. 잠시 후 다시 시도해주세요.",
    );
  if (data?.[0]?.allowed !== true)
    throw Object.assign(
      new Error("오늘 생성 요청을 모두 사용했어요. 나중에 다시 시도해주세요."),
      { retryable: false },
    );
}

export async function createPicturebookAction(
  input: PicturebookInput,
  accessToken: string,
  requestId: string,
): Promise<CreateResult> {
  const invalid = validatePicturebookInput(input);
  if (invalid) return { ok: false, message: invalid };
  if (
    typeof requestId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      requestId,
    )
  )
    return { ok: false, message: "생성 요청을 다시 시작해주세요." };
  let auth: Awaited<ReturnType<typeof requireServerUser>>;
  try {
    auth = await requireServerUser(accessToken);
  } catch (cause) {
    return {
      ...failure(cause, "로그인을 확인해주세요."),
      retrySameRequest: true,
    };
  }
  const { user, client } = auth;
  const key = `${user.id}:${requestId}`;
  const existing = creating.get(key);
  if (existing) return existing;
  const operation = (async (): Promise<CreateResult> => {
    let requestConfirmedAbsent = false;
    let commitAttempted = false;
    try {
      const { data: prior, error: priorError } = await client
        .from("thread")
        .select("id, raw_text")
        .eq("user_id", user.id)
        .eq("openai_thread_id", `picturebook_${requestId}`)
        .maybeSingle();
      if (priorError)
        throw new Error(
          "이전 요청을 확인하지 못했어요. 내 책장을 확인해주세요.",
        );
      requestConfirmedAbsent = !prior;
      const savedBook = parsePicturebookDraft(prior?.raw_text);
      const { data: balance, error: balanceError } = await client
        .from("bead")
        .select("count")
        .eq("user_id", user.id)
        .single();
      if (balanceError)
        throw new Error("곶감 정보를 확인하지 못했어요. 다시 로그인해주세요.");
      const currentCount = beadCount(balance?.count);
      if (savedBook && prior) {
        if (!Number.isSafeInteger(prior.id) || prior.id <= 0)
          throw new Error("저장된 그림책 주소를 확인하지 못했어요.");
        return {
          ok: true,
          book: savedBook,
          threadId: prior.id,
          beadCount: currentCount,
        };
      }
      if (prior)
        return {
          ok: false,
          message:
            "이전 생성 요청의 저장 상태를 확인해야 해요. 내 책장을 확인하고 운영팀에 문의해주세요.",
          retrySameRequest: true,
          retryable: false,
        };
      if (currentCount < 1)
        throw new Error("곶감이 부족해요. 보유 곶감을 확인해주세요.");
      const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const serverUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!serverKey || !serverUrl)
        return {
          ok: false,
          message:
            "그림책 저장 서비스를 준비하고 있어요. 운영팀에 문의해주세요.",
          retrySameRequest: false,
          retryable: false,
        };
      let admin: SupabaseClient;
      try {
        admin = createClient(serverUrl, serverKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const readiness = await admin.rpc("picturebook_storage_ready");
        if (readiness.error || readiness.data !== true)
          throw new Error("Picturebook storage is not ready");
      } catch {
        throw Object.assign(
          new Error(
            "그림책 저장 서비스에 연결할 수 없어요. 운영팀에 문의해주세요.",
          ),
          { retryable: false },
        );
      }
      await quota(client, user.id, "start");
      const book = await generatePicturebookStart(input, accessToken);
      if (
        !parsePicturebookDraft(JSON.stringify(book)) ||
        book.status !== "choice-ready"
      )
        throw new Error("그림책 응답을 확인하지 못했어요. 다시 시도해주세요.");
      const payload = {
        p_user_id: user.id,
        p_request_id: requestId,
        p_book: book,
      };
      const commit = async () => {
        try {
          return await admin.rpc("commit_picturebook_start", payload);
        } catch (error) {
          return { data: null, error };
        }
      };
      // Saving the manuscript, debit and ledger are one transaction. The same
      // payload is safe to retry even if a committed response was lost.
      commitAttempted = true;
      let committed = await commit();
      if (committed.error && !knownCommitError(committed.error))
        committed = await commit();
      if (committed.error) throw picturebookCommitError(committed.error);
      const row =
        Array.isArray(committed.data) && committed.data.length === 1
          ? committed.data[0]
          : null;
      const saved =
        typeof row?.raw_text === "string"
          ? parsePicturebookDraft(row.raw_text)
          : null;
      if (!saved || !Number.isSafeInteger(row?.thread_id) || row.thread_id <= 0)
        throw new Error(
          "그림책 저장 결과를 확인하지 못했어요. 내 책장을 확인하거나 같은 요청을 다시 확인해주세요.",
        );
      return {
        ok: true,
        book: saved,
        threadId: row.thread_id,
        beadCount: beadCount(row.bead_count),
      };
    } catch (cause) {
      return {
        ...failure(cause, "그림책을 만들지 못했어요."),
        retrySameRequest: !requestConfirmedAbsent || commitAttempted,
      };
    }
  })();
  creating.set(key, operation);
  try {
    return await operation;
  } finally {
    creating.delete(key);
  }
}

export async function finishPicturebookAction(
  threadId: number,
  choiceId: PicturebookChoiceOption["id"],
  accessToken: string,
): Promise<FinishResult> {
  if (
    !Number.isSafeInteger(threadId) ||
    threadId < 1 ||
    !["A", "B", "C"].includes(choiceId)
  )
    return {
      ok: false,
      message: "그림책과 선택지를 확인해주세요.",
      retryable: false,
    };
  let auth: Awaited<ReturnType<typeof requireServerUser>>;
  try {
    auth = await requireServerUser(accessToken);
  } catch (cause) {
    return failure(cause, "로그인을 확인해주세요.");
  }
  const { user, client } = auth;
  const key = `${user.id}:${threadId}`;
  const existing = finishing.get(key);
  if (existing) return existing;
  const operation = (async (): Promise<FinishResult> => {
    try {
      const { data: thread, error } = await client
        .from("thread")
        .select("raw_text")
        .eq("id", threadId)
        .eq("user_id", user.id)
        .single();
      if (error) throw new Error("내 계정의 그림책을 찾을 수 없어요.");
      const book = parsePicturebookDraft(thread.raw_text);
      if (!book) throw new Error("그림책 내용을 확인해주세요.");
      if (book.status === "complete") return { ok: true, book };
      await quota(client, user.id, "ending");
      const complete = await generatePicturebookEnding(
        book,
        choiceId,
        accessToken,
      );
      if (
        !parsePicturebookDraft(JSON.stringify(complete)) ||
        complete.status !== "complete"
      )
        throw new Error("결말 응답을 확인하지 못했어요. 다시 시도해주세요.");
      // Compare the original story as well: concurrent choices must not overwrite the first ending.
      const { data: updated, error: saveError } = await client
        .from("thread")
        .update({ raw_text: JSON.stringify(complete) })
        .eq("id", threadId)
        .eq("user_id", user.id)
        .eq("raw_text", thread.raw_text)
        .select("id");
      if (saveError || !updated?.length) {
        const { data: latest } = await client
          .from("thread")
          .select("raw_text")
          .eq("id", threadId)
          .eq("user_id", user.id)
          .single();
        const saved = parsePicturebookDraft(latest?.raw_text);
        if (saved?.status === "complete") return { ok: true, book: saved };
        throw new Error(
          "결말 저장을 확인하지 못했어요. 내 책장에서 다시 확인해주세요.",
        );
      }
      return { ok: true, book: complete };
    } catch (cause) {
      return failure(
        cause,
        "결말을 만들지 못했어요. 잠시 후 다시 시도해주세요.",
      );
    }
  })();
  finishing.set(key, operation);
  try {
    return await operation;
  } finally {
    finishing.delete(key);
  }
}

export async function drawPicturebookPageAction(
  threadId: number,
  pageNumber: number,
  accessToken: string,
): Promise<DrawResult> {
  if (
    !Number.isSafeInteger(threadId) ||
    threadId < 1 ||
    !Number.isInteger(pageNumber) ||
    pageNumber < 1 ||
    pageNumber > 8
  )
    return {
      ok: false,
      message: "그림책 페이지를 확인해주세요.",
      retryable: false,
    };
  let auth: Awaited<ReturnType<typeof requireServerUser>>;
  try {
    auth = await requireServerUser(accessToken);
  } catch (cause) {
    return failure(cause, "로그인을 확인해주세요.");
  }
  const { user, client } = auth;
  const key = `${user.id}:${threadId}:${pageNumber}`;
  const pending = drawing.get(key);
  if (pending) return pending;
  const operation = (async (): Promise<DrawResult> => {
    try {
      const { data: thread, error } = await client
        .from("thread")
        .select("raw_text")
        .eq("id", threadId)
        .eq("user_id", user.id)
        .single();
      if (error) throw new Error("내 계정의 그림책을 찾을 수 없어요.");
      const book = parsePicturebookDraft(thread.raw_text);
      const page = book?.pages.find(item => item.pageNumber === pageNumber);
      if (!book || !page) throw new Error("그림책 페이지가 없어요.");
      const path = `image_thread_id_${threadId}_page_${pageNumber}`;
      const bucket = client.storage.from("image");
      const existing = await bucket.createSignedUrl(path, 3600);
      const markSaved = async () => {
        const { error: markerError } = await client
          .from("thread")
          .update({ has_image: true })
          .eq("id", threadId)
          .eq("user_id", user.id)
          .select("id")
          .single();
        if (markerError)
          throw new Error(
            "저장된 그림을 책장에 연결하지 못했어요. 다시 시도해주세요.",
          );
      };
      if (!existing.error && existing.data?.signedUrl) {
        await markSaved();
        return { ok: true, url: existing.data.signedUrl };
      }
      if (!imageIsMissing(existing.error))
        throw new Error(
          "저장된 그림을 확인하지 못했어요. 잠시 후 다시 시도해주세요.",
        );
      await quota(client, user.id, "image");
      const result = await generatePicturebookPageImage(
        {
          title: book.title,
          childName: book.childName,
          ageBand: book.ageBand,
          visualStyle: book.storyGuide?.visualStyle,
          pageNumber,
          textKo: page.textKo,
          imagePrompt: page.imagePrompt,
          previousPages: book.pages
            .filter(previous => previous.pageNumber < pageNumber)
            .map(previous => ({
              pageNumber: previous.pageNumber,
              textKo: previous.textKo.slice(0, 900),
            })),
        },
        accessToken,
      );
      const bytes = decodePageImage(result.data[0]?.b64_json);
      const { error: uploadError } = await bucket.upload(path, bytes, {
        contentType: "image/png",
        upsert: false,
      });
      // Read after an upload error too: another instance may have won, or the
      // upload committed but its response was lost. Never overwrite a saved page.
      const { data: saved, error: imageError } = await bucket.createSignedUrl(
        path,
        3600,
      );
      if (imageError || !saved?.signedUrl)
        throw new Error(
          uploadError
            ? "그림을 저장하지 못했어요. 다시 시도해주세요."
            : "저장된 그림을 열지 못했어요. 다시 시도해주세요.",
        );
      await markSaved();
      return { ok: true, url: saved.signedUrl };
    } catch (cause) {
      return failure(
        cause,
        "그림을 만들지 못했어요. 잠시 후 다시 시도해주세요.",
      );
    }
  })();
  drawing.set(key, operation);
  try {
    return await operation;
  } finally {
    drawing.delete(key);
  }
}

"use server";

import { createClient } from "@supabase/supabase-js";

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
    return failure(cause, "로그인을 확인해주세요.");
  }
  const { user, client } = auth;
  const key = `${user.id}:${requestId}`;
  const existing = creating.get(key);
  if (existing) return existing;
  const operation = (async (): Promise<CreateResult> => {
    let charged = false;
    let createdId: number | null = null;
    let debitAttempted = false;
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
      const savedBook = parsePicturebookDraft(prior?.raw_text);
      const { data: balance, error: balanceError } = await client
        .from("bead")
        .select("count")
        .eq("user_id", user.id)
        .single();
      if (balanceError)
        throw new Error("곶감 정보를 확인하지 못했어요. 다시 로그인해주세요.");
      const currentCount = beadCount(balance?.count);
      if (savedBook && prior)
        return {
          ok: true,
          book: savedBook,
          threadId: prior.id,
          beadCount: currentCount,
        };
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
      await quota(client, user.id, "start");
      const book = await generatePicturebookStart(input, accessToken);
      if (
        !parsePicturebookDraft(JSON.stringify(book)) ||
        book.status !== "choice-ready"
      )
        throw new Error("그림책 응답을 확인하지 못했어요. 다시 시도해주세요.");
      const { data: thread, error: threadError } = await client
        .from("thread")
        .insert({
          openai_thread_id: `picturebook_${requestId}`,
          user_id: user.id,
          able_english: false,
          has_image: false,
        })
        .select("id")
        .single();
      if (threadError)
        throw new Error("책장을 준비하지 못했어요. 다시 시도해주세요.");
      createdId = thread.id;
      debitAttempted = true;
      const charge = async () => {
        try {
          return await client.rpc("consume_beads", {
            p_user_id: user.id,
            p_cost: 1,
            p_request_id: `picturebook_${requestId}`,
          });
        } catch (error) {
          return { data: null, error };
        }
      };
      // The RPC is idempotent. A lost response must not strand a committed debit.
      let chargedResult = await charge();
      if (chargedResult.error) chargedResult = await charge();
      const { data: count, error: chargeError } = chargedResult;
      if (chargeError)
        throw new Error(
          "곶감 사용 상태를 확인하지 못했어요. 보유 수량을 확인해주세요.",
        );
      charged = true;
      const remaining = beadCount(count);
      const { error: saveError } = await client
        .from("thread")
        .update({ raw_text: JSON.stringify(book) })
        .eq("id", thread.id)
        .eq("user_id", user.id)
        .select("id")
        .single();
      if (saveError) throw new Error("그림책 저장 상태를 확인하지 못했어요.");
      return { ok: true, book, threadId: thread.id, beadCount: remaining };
    } catch (cause) {
      let message =
        cause instanceof Error ? cause.message : "그림책을 만들지 못했어요.";
      if (charged && createdId) {
        // Check ambiguous write failures before refunding a book that may be saved.
        const { data: saved, error: checkError } = await client
          .from("thread")
          .select("raw_text")
          .eq("id", createdId)
          .eq("user_id", user.id)
          .single();
        const book = parsePicturebookDraft(saved?.raw_text);
        if (!checkError && book) {
          const { data: balance } = await client
            .from("bead")
            .select("count")
            .eq("user_id", user.id)
            .single();
          return {
            ok: true,
            book,
            threadId: createdId,
            beadCount: Number(balance?.count ?? 0),
          };
        }
        const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!checkError && !saved?.raw_text && serverKey) {
          const admin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serverKey,
            { auth: { persistSession: false, autoRefreshToken: false } },
          );
          const { error: refundError } = await admin.rpc("credit_beads", {
            p_user_id: user.id,
            p_amount: 1,
          });
          message += refundError
            ? " 곶감 복구를 확인하지 못했어요. 문의하기로 알려주세요."
            : " 사용한 곶감은 돌려드렸어요.";
        } else {
          message +=
            " 곶감 사용 여부와 내 책장을 확인하고, 복구가 필요하면 문의하기로 알려주세요.";
        }
      }
      return {
        ...failure(cause, "그림책을 만들지 못했어요."),
        message,
        retrySameRequest: createdId !== null || debitAttempted,
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
          pageNumber,
          textKo: page.textKo,
          imagePrompt: page.imagePrompt,
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

import { randomUUID } from "crypto";

import { SupabaseClient } from "@supabase/supabase-js";

import { StoryTurnResult } from "@/lib/ai/story-service";

interface ThreadRow {
  id: number;
  user_id: string;
  able_english: boolean;
  has_image: boolean;
  raw_text: string | null;
}

function isNotFound(error: { code?: string } | null): boolean {
  return error?.code === "PGRST116";
}

export async function ensureBeadRow(
  admin: SupabaseClient,
  userId: string,
): Promise<{ id: string; count: number }> {
  const { data, error } = await admin
    .from("bead")
    .select("id, count")
    .eq("user_id", userId)
    .single();

  if (!error && data) {
    return {
      id: String(data.id),
      count: Number(data.count || 0),
    };
  }

  if (error && !isNotFound(error)) {
    throw error;
  }

  const { data: inserted, error: insertError } = await admin
    .from("bead")
    .insert({ user_id: userId, count: 0 })
    .select("id, count")
    .single();

  if (insertError || !inserted) {
    throw insertError || new Error("Failed to initialize bead row");
  }

  return {
    id: String(inserted.id),
    count: Number(inserted.count || 0),
  };
}

export async function debitBeads(
  admin: SupabaseClient,
  userId: string,
  cost: number,
  requestId?: string | null,
): Promise<number> {
  if (cost <= 0) {
    const bead = await ensureBeadRow(admin, userId);
    return bead.count;
  }

  const normalizedRequestId =
    typeof requestId === "string" && requestId.trim().length > 0
      ? requestId.trim()
      : null;

  const { data, error } = await admin.rpc("consume_beads", {
    p_user_id: userId,
    p_cost: cost,
    p_request_id: normalizedRequestId,
  });

  if (error) {
    if (
      typeof error.message === "string" &&
      error.message.includes("INSUFFICIENT_BEADS")
    ) {
      throw new Error("INSUFFICIENT_BEADS");
    }
    throw error;
  }

  if (typeof data === "number") {
    return Number(data);
  }

  if (Array.isArray(data) && data.length > 0) {
    return Number(data[0] || 0);
  }

  throw new Error("INVALID_BEAD_RPC_RESULT");
}

export async function creditBeads(
  admin: SupabaseClient,
  userId: string,
  amount: number,
): Promise<number> {
  if (amount <= 0) {
    const bead = await ensureBeadRow(admin, userId);
    return bead.count;
  }

  const { data, error } = await admin.rpc("credit_beads", {
    p_user_id: userId,
    p_amount: amount,
  });

  if (error) {
    throw error;
  }

  if (typeof data === "number") {
    return Number(data);
  }

  if (Array.isArray(data) && data.length > 0) {
    return Number(data[0] || 0);
  }

  throw new Error("INVALID_BEAD_CREDIT_RPC_RESULT");
}

export async function createStoryThread(
  admin: SupabaseClient,
  userId: string,
  options: { includeEnglish: boolean; includeImage: boolean },
): Promise<ThreadRow> {
  const { data, error } = await admin
    .from("thread")
    .insert({
      openai_thread_id: `thread_${randomUUID()}`,
      user_id: userId,
      able_english: options.includeEnglish,
      has_image: options.includeImage,
      raw_text: "",
    })
    .select("id, user_id, able_english, has_image, raw_text")
    .single();

  if (error || !data) {
    throw error || new Error("Failed to create thread");
  }

  return data as ThreadRow;
}

export async function saveKeywords(
  admin: SupabaseClient,
  threadId: number,
  keywords: string[],
) {
  const records = keywords
    .map(item => item.trim())
    .filter(Boolean)
    .map(keyword => ({ thread_id: threadId, keyword }));

  if (records.length === 0) return;

  const { error } = await admin.from("keywords").insert(records);
  if (error) throw error;
}

export async function getNextTurn(admin: SupabaseClient, threadId: number) {
  const { data, error } = await admin
    .from("messages")
    .select("turn")
    .eq("thread_id", threadId)
    .order("turn", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) return 0;
  return Number(data[0].turn || 0) + 1;
}

export async function saveStoryTurn(
  admin: SupabaseClient,
  threadId: number,
  turn: number,
  story: StoryTurnResult,
) {
  const messageRows = story.paragraphs.map((paragraph, index) => ({
    thread_id: threadId,
    turn,
    message: paragraph,
    message_en: story.paragraphsEn[index] || "",
  }));

  const selectionRows = story.choices.map((choice, index) => ({
    thread_id: threadId,
    turn,
    selection: choice,
    selection_en: story.choicesEn[index] || "",
  }));

  if (messageRows.length > 0) {
    const { error } = await admin.from("messages").insert(messageRows);
    if (error) throw error;
  }

  if (selectionRows.length > 0) {
    const { error } = await admin.from("selections").insert(selectionRows);
    if (error) throw error;
  }
}

export async function appendThreadRawText(
  admin: SupabaseClient,
  thread: ThreadRow,
  story: StoryTurnResult,
) {
  const nextText =
    `${thread.raw_text || ""}\n${story.paragraphs.join("\n")}`.trim();

  const { error } = await admin
    .from("thread")
    .update({ raw_text: nextText })
    .eq("id", thread.id)
    .eq("user_id", thread.user_id);

  if (error) throw error;
}

export async function getThreadForUser(
  admin: SupabaseClient,
  threadId: number,
  userId: string,
): Promise<ThreadRow> {
  const { data, error } = await admin
    .from("thread")
    .select("id, user_id, able_english, has_image, raw_text")
    .eq("id", threadId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (isNotFound(error)) {
      throw new Error("THREAD_NOT_FOUND");
    }
    throw error;
  }

  if (!data) {
    throw new Error("THREAD_NOT_FOUND");
  }

  return data as ThreadRow;
}

export async function uploadThreadImage(
  admin: SupabaseClient,
  userId: string,
  threadId: number,
  base64Data: string,
): Promise<string> {
  const binary = Buffer.from(base64Data, "base64");
  const path = `${userId}/thread_${threadId}/cover_${Date.now()}.png`;

  const { error } = await admin.storage.from("image").upload(path, binary, {
    contentType: "image/png",
    upsert: false,
  });

  if (error) throw error;

  const { data, error: signedUrlError } = await admin.storage
    .from("image")
    .createSignedUrl(path, 60 * 60);

  if (signedUrlError || !data?.signedUrl) {
    throw signedUrlError || new Error("Failed to create image signed URL");
  }

  const { error: updateError } = await admin
    .from("thread")
    .update({ has_image: true })
    .eq("id", threadId)
    .eq("user_id", userId);

  if (updateError) throw updateError;

  return data.signedUrl;
}

export async function getMessagesForThread(
  admin: SupabaseClient,
  threadId: number,
) {
  const { data, error } = await admin
    .from("messages")
    .select("id, thread_id, turn, message, message_en, created_at")
    .eq("thread_id", threadId)
    .order("id", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function updateMessageTranslations(
  admin: SupabaseClient,
  threadId: number,
  translated: string[],
) {
  const messages = await getMessagesForThread(admin, threadId);
  const targets = messages
    .filter(
      message =>
        typeof message.message === "string" &&
        message.message.trim().length > 0 &&
        !message.message_en,
    )
    .slice(0, translated.length)
    .map((message, index) => ({
      id: message.id,
      textEn: translated[index],
    }))
    .filter(item => typeof item.textEn === "string");

  if (targets.length === 0) return;

  const results = await Promise.all(
    targets.map(target =>
      admin
        .from("messages")
        .update({ message_en: target.textEn })
        .eq("id", target.id),
    ),
  );

  const failed = results.find(result => result.error);
  if (failed?.error) {
    throw failed.error;
  }
}

export async function getLatestThreadImageSignedUrl(
  admin: SupabaseClient,
  userId: string,
  threadId: number,
): Promise<string | null> {
  const { data, error } = await admin.storage
    .from("image")
    .list(`${userId}/thread_${threadId}`, {
      sortBy: { column: "created_at", order: "desc" },
      limit: 1,
    });

  if (error || !data || data.length === 0) return null;

  const file = data[0];
  const fullPath = `${userId}/thread_${threadId}/${file.name}`;

  const { data: signed } = await admin.storage
    .from("image")
    .createSignedUrl(fullPath, 60 * 60);

  return signed?.signedUrl ?? null;
}

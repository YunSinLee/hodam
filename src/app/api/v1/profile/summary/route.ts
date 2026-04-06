import { NextRequest } from "next/server";

import {
  authenticateRequest,
  requireUserClient,
} from "@/lib/auth/request-auth";
import { logError } from "@/lib/server/logger";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createApiRequestContext } from "@/lib/server/request-context";

interface ThreadRow {
  id: number;
}

interface RecentThreadRow {
  id: number;
  created_at: string;
  able_english: boolean;
  has_image: boolean;
}

interface PaymentRow {
  bead_quantity: number | null;
  amount: number | null;
}

interface KeywordRow {
  thread_id: number;
  keyword: string;
}

export async function GET(request: NextRequest) {
  const { fail, ok, requestId } = createApiRequestContext(request);
  const auth = await authenticateRequest(request);
  if (!auth) {
    return fail(401, "Unauthorized");
  }

  if (!checkRateLimit(`profile:summary:${auth.userId}`, 60, 60_000)) {
    return fail(429, "Too many profile summary requests");
  }

  try {
    const userClient = requireUserClient(auth.accessToken);

    const limitParam = Number(request.nextUrl.searchParams.get("limit") || "5");
    const recentLimit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(Math.floor(limitParam), 20)
        : 5;

    const { data: authUserData, error: authUserError } =
      await userClient.auth.getUser();
    if (authUserError || !authUserData.user) {
      return fail(401, "Unauthorized");
    }

    const authUser = authUserData.user;

    const { data: existingUser, error: userRowError } = await userClient
      .from("users")
      .select("display_name, custom_profile_url")
      .eq("id", auth.userId)
      .maybeSingle();

    if (userRowError) {
      throw userRowError;
    }

    let userRow = existingUser;
    if (!userRow) {
      const defaultDisplayName =
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        `User_${auth.userId.slice(-8)}`;

      const { data: createdUser, error: createUserError } = await userClient
        .from("users")
        .insert({
          id: auth.userId,
          email: auth.email,
          display_name: defaultDisplayName,
        })
        .select("display_name, custom_profile_url")
        .single();

      if (createUserError) {
        throw createUserError;
      }

      userRow = createdUser;
    }

    const [threadsResult, paymentsResult, recentThreadsResult] =
      await Promise.all([
        userClient.from("thread").select("id").eq("user_id", auth.userId),
        userClient
          .from("payment_history")
          .select("bead_quantity, amount")
          .eq("user_id", auth.userId)
          .eq("status", "completed"),
        userClient
          .from("thread")
          .select("id, created_at, able_english, has_image")
          .eq("user_id", auth.userId)
          .order("created_at", { ascending: false })
          .limit(recentLimit),
      ]);

    if (threadsResult.error) throw threadsResult.error;
    if (paymentsResult.error) throw paymentsResult.error;
    if (recentThreadsResult.error) throw recentThreadsResult.error;

    const threads = (threadsResult.data || []) as ThreadRow[];
    const payments = (paymentsResult.data || []) as PaymentRow[];
    const recentThreads = (recentThreadsResult.data || []) as RecentThreadRow[];

    const threadIds = threads.map(thread => thread.id);

    let totalBeadsUsed = 0;
    if (threadIds.length > 0) {
      const { count, error: messageCountError } = await userClient
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("thread_id", threadIds);

      if (messageCountError) {
        throw messageCountError;
      }

      totalBeadsUsed = count || 0;
    }

    const totalBeadsPurchased = payments.reduce(
      (sum, payment) => sum + (payment.bead_quantity || 0),
      0,
    );
    const totalPaymentAmount = payments.reduce(
      (sum, payment) => sum + (payment.amount || 0),
      0,
    );

    const recentThreadIds = recentThreads.map(thread => thread.id);
    let keywordRows: KeywordRow[] = [];

    if (recentThreadIds.length > 0) {
      const { data, error } = await userClient
        .from("keywords")
        .select("thread_id, keyword")
        .in("thread_id", recentThreadIds);

      if (error) {
        throw error;
      }

      keywordRows = (data || []) as KeywordRow[];
    }

    const keywordsByThreadId = new Map<number, { keyword: string }[]>();
    keywordRows.forEach(({ thread_id, keyword }) => {
      const existing = keywordsByThreadId.get(thread_id) || [];
      existing.push({ keyword });
      keywordsByThreadId.set(thread_id, existing);
    });

    const profile = {
      id: auth.userId,
      email: auth.email || "",
      display_name:
        userRow?.display_name ||
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        "사용자",
      profileUrl:
        userRow?.custom_profile_url || authUser.user_metadata?.avatar_url || "",
      custom_profile_url: userRow?.custom_profile_url || undefined,
      created_at: authUser.created_at,
      totalStories: threads.length,
      totalBeadsPurchased,
      totalBeadsUsed,
    };

    const stats = {
      totalStories: threads.length,
      totalBeadsPurchased,
      totalBeadsUsed,
      totalPaymentAmount,
      joinDate: authUser.created_at,
    };

    const recentStories = recentThreads.map(thread => ({
      ...thread,
      keywords: keywordsByThreadId.get(thread.id) || [],
    }));

    return ok({
      profile,
      stats,
      recentStories,
    });
  } catch (error) {
    logError("/api/v1/profile/summary", error, {
      requestId,
      userId: auth.userId,
    });
    return fail(500, "Failed to fetch profile summary");
  }
}

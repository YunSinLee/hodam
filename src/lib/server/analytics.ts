import { NextRequest } from "next/server";

import { SupabaseClient } from "@supabase/supabase-js";

interface ActivityPayload {
  user_id: string;
  action: string;
  details: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
}

function getClientIp(request?: NextRequest): string | undefined {
  if (!request) return undefined;

  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const candidate = (forwarded?.split(",")[0] || realIp || "").trim();

  if (!candidate || candidate.toLowerCase() === "unknown") {
    return undefined;
  }

  return candidate;
}

function getUserAgent(request?: NextRequest): string | undefined {
  if (!request) return undefined;
  const userAgent = (request.headers.get("user-agent") || "").trim();
  return userAgent || undefined;
}

export async function trackUserActivity(
  admin: SupabaseClient,
  userId: string,
  action: string,
  details: Record<string, unknown> = {},
  request?: NextRequest,
) {
  const payload: ActivityPayload = {
    user_id: userId,
    action,
    details,
  };

  const ip = getClientIp(request);
  if (ip) {
    payload.ip_address = ip;
  }

  const userAgent = getUserAgent(request);
  if (userAgent) {
    payload.user_agent = userAgent;
  }

  const { error } = await admin.from("user_activity_logs").insert(payload);
  if (error) {
    throw error;
  }
}

export async function trackUserActivityBestEffort(
  admin: SupabaseClient,
  userId: string,
  action: string,
  details: Record<string, unknown> = {},
  request?: NextRequest,
) {
  try {
    await trackUserActivity(admin, userId, action, details, request);
  } catch (error) {
    // Analytics is best-effort and must not break product flows.
  }
}

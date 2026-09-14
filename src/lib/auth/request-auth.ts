import { NextRequest } from "next/server";

import { logError } from "@/lib/server/logger";
import {
  createSupabaseAnonServerClient,
  createSupabaseUserServerClient,
} from "@/lib/supabase/server";

export interface AuthContext {
  accessToken: string;
  userId: string;
  email: string | null;
}

function parseBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const matched = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!matched?.[1]) return null;
  const token = matched[1].trim();
  return token.length > 0 ? token : null;
}

export async function authenticateRequest(
  request: NextRequest,
): Promise<AuthContext | null> {
  const accessToken = parseBearerToken(request.headers.get("authorization"));
  if (!accessToken) return null;

  try {
    const anonClient = createSupabaseAnonServerClient();
    const { data, error } = await anonClient.auth.getUser(accessToken);

    if (error || !data.user) return null;

    return {
      accessToken,
      userId: data.user.id,
      email: data.user.email ?? null,
    };
  } catch (error) {
    // Keep API auth boundary fail-closed (401) instead of throwing 500 on auth transport issues.
    logError("authenticateRequest", error);
    return null;
  }
}

export function requireUserClient(accessToken: string) {
  return createSupabaseUserServerClient(accessToken);
}

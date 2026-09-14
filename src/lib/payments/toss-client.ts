import { getOptionalEnv } from "@/lib/env";

export function resolveTossClientKey(): string | null {
  const clientKey = getOptionalEnv("NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY");
  if (!clientKey) {
    return null;
  }

  return clientKey;
}

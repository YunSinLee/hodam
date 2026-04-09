import { shouldLoadNavBarBeadCount } from "@/app/components/navigation/nav-bar-controller-utils";
import type { Bead } from "@/services/hooks/use-bead";

import type { Session } from "@supabase/supabase-js";

export type SessionReader = () => Promise<{
  data: {
    session: Session | null;
  };
}>;

export async function readNavBarSession(
  readSession: SessionReader,
): Promise<Session | null> {
  try {
    const {
      data: { session },
    } = await readSession();
    return session || null;
  } catch {
    return null;
  }
}

interface ResolveNavBarBeadValueParams {
  userId: string | undefined;
  loadBead: () => Promise<Bead>;
  fallbackBead: Bead;
}

export async function resolveNavBarBeadValue({
  userId,
  loadBead,
  fallbackBead,
}: ResolveNavBarBeadValueParams): Promise<Bead> {
  if (!shouldLoadNavBarBeadCount(userId)) {
    return fallbackBead;
  }

  try {
    return await loadBead();
  } catch {
    return fallbackBead;
  }
}

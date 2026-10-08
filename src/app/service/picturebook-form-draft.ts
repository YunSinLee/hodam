import { z } from "zod";

import type {
  PicturebookAdventure,
  PicturebookInput,
} from "@/app/types/openai";
import { defaultAdventure } from "@/lib/picturebook/adventure";

export interface PicturebookFormModes {
  daily: { situation: string; lesson: string };
  adventure: {
    adventure: PicturebookAdventure;
    situation: string;
    lesson: string;
  };
}

export interface PicturebookFormDraft {
  input: PicturebookInput;
  modes: PicturebookFormModes;
  savedAt: number;
}

const prefix = "hodam-picturebook-form-draft:v1:";
const guestKey = `${prefix}guest`;
const loginKey = `${prefix}login`;
const ttl = 2 * 60 * 60 * 1000;
const maxRawBytes = 16 * 1024;
const ownerSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,256}$/);

// Drafts may contain unfinished fields; request validation remains stricter.
const adventureSchema = z.object({
  world: z.enum(["moon-bakery", "dinosaur-post", "ocean-library"]),
  companion: z.enum(["rabbit", "fox", "dinosaur"]),
  companionName: z.string().max(20),
  heroStyle: z.enum(["short", "bob", "curly"]),
});
const scenarioSchema = z.object({
  situation: z.string().max(500),
  lesson: z.string().max(200),
});
const inputSchema = scenarioSchema.extend({
  childName: z.string().max(20),
  childAge: z.string().regex(/^(?:|[3-9]|1[0-2])$/),
  tone: z.enum(["calm", "playful", "brave"]),
  interests: z.string().max(100).optional(),
  adventure: adventureSchema.optional(),
});
const modesSchema = z.object({
  daily: scenarioSchema,
  adventure: scenarioSchema.extend({ adventure: adventureSchema }),
});
const draftSchema = z.object({
  input: inputSchema,
  modes: modesSchema,
  savedAt: z.number().int().positive().safe(),
});
const envelopeSchema = z.object({
  version: z.literal(1),
  owner: ownerSchema.nullable(),
  draft: draftSchema,
});
const loginSchema = envelopeSchema.extend({
  owner: z.null(),
  boundOwner: ownerSchema.nullable(),
});

function keyFor(ownerId: string | undefined) {
  if (ownerId === undefined) return guestKey;
  return ownerSchema.safeParse(ownerId).success
    ? `${prefix}user:${ownerId}`
    : null;
}

function storage() {
  return typeof window === "undefined" ? null : window.sessionStorage;
}

function parseRaw(raw: string | null): unknown {
  if (
    !raw ||
    raw.length > maxRawBytes ||
    new TextEncoder().encode(raw).byteLength > maxRawBytes
  )
    return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function validTime(savedAt: number) {
  const now = Date.now();
  return savedAt <= now && now - savedAt < ttl;
}

function serialize(value: unknown) {
  const raw = JSON.stringify(value);
  return new TextEncoder().encode(raw).byteLength <= maxRawBytes ? raw : null;
}

export function createFormModes(input: PicturebookInput): PicturebookFormModes {
  return {
    daily: {
      situation: input.adventure ? "" : input.situation,
      lesson: input.adventure ? "" : input.lesson,
    },
    adventure: {
      adventure: { ...(input.adventure || defaultAdventure) },
      situation: input.adventure ? input.situation : "",
      lesson: input.adventure ? input.lesson : "",
    },
  };
}

export function readFormDraft(ownerId: string | undefined): {
  draft: PicturebookFormDraft | null;
  available: boolean;
} {
  try {
    const key = keyFor(ownerId);
    const target = storage();
    if (!key || !target) return { draft: null, available: false };
    const parsed = envelopeSchema.safeParse(parseRaw(target.getItem(key)));
    const valid =
      parsed.success &&
      parsed.data.owner === (ownerId ?? null) &&
      validTime(parsed.data.draft.savedAt);
    return { draft: valid ? parsed.data.draft : null, available: true };
  } catch {
    return { draft: null, available: false };
  }
}

export function saveFormDraft(
  ownerId: string | undefined,
  input: PicturebookInput,
  modes: PicturebookFormModes,
) {
  try {
    const key = keyFor(ownerId);
    const target = storage();
    if (!key || !target) return false;
    const parsed = draftSchema.safeParse({ input, modes, savedAt: Date.now() });
    if (!parsed.success) return false;
    const raw = serialize({
      version: 1,
      owner: ownerId ?? null,
      draft: parsed.data,
    });
    if (!raw) return false;
    target.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}

export function clearFormDraft(ownerId: string | undefined) {
  try {
    const key = keyFor(ownerId);
    const target = storage();
    if (!key || !target) return false;
    // Clear handoff first so a failed delete cannot unexpectedly revive a draft.
    if (ownerId === undefined) target.removeItem(loginKey);
    else {
      const handoff = loginSchema.safeParse(parseRaw(target.getItem(loginKey)));
      if (
        handoff.success &&
        handoff.data.boundOwner === ownerId &&
        validTime(handoff.data.draft.savedAt)
      )
        target.removeItem(loginKey);
    }
    target.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/** Called only when the user deliberately starts login from this guest form. */
export function prepareFormDraftLogin() {
  try {
    const target = storage();
    if (!target) return false;
    const { draft, available } = readFormDraft(undefined);
    if (!available) return false;
    if (!draft) {
      target.removeItem(loginKey);
      return false;
    }
    const raw = serialize({ version: 1, owner: null, boundOwner: null, draft });
    if (!raw) return false;
    target.setItem(loginKey, raw);
    return true;
  } catch {
    return false;
  }
}

export function consumeFormDraftLogin(ownerId: string): {
  draft: PicturebookFormDraft | null;
  available: boolean;
} {
  try {
    const key = keyFor(ownerId);
    const target = storage();
    if (!key || !target || !ownerSchema.safeParse(ownerId).success)
      return { draft: null, available: false };
    const parsed = loginSchema.safeParse(parseRaw(target.getItem(loginKey)));
    if (
      !parsed.success ||
      !validTime(parsed.data.draft.savedAt) ||
      (parsed.data.boundOwner !== null && parsed.data.boundOwner !== ownerId)
    )
      return { draft: null, available: true };
    const { draft } = parsed.data;
    const bound = serialize({
      version: 1,
      owner: null,
      boundOwner: ownerId,
      draft,
    });
    const owned = serialize({ version: 1, owner: ownerId, draft });
    if (!bound || !owned) return { draft: null, available: true };
    // Bind before copying: even a partial storage failure cannot give this
    // explicitly handed-off draft to a second account.
    target.setItem(loginKey, bound);
    target.setItem(key, owned);
    target.removeItem(guestKey);
    target.removeItem(loginKey);
    return { draft, available: true };
  } catch {
    return { draft: null, available: false };
  }
}

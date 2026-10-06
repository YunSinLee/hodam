import type { PicturebookInput } from "@/app/types/openai";
import { validatePicturebookInput } from "@/app/utils/picturebook";

export interface PendingPicturebookRequest {
  userId: string;
  requestId: string;
  input: PicturebookInput;
}

const storageKey = (userId: string) => `hodam-picturebook-request:${userId}`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RecoveryState {
  pending: PendingPicturebookRequest | null;
  unconfirmed: PendingPicturebookRequest[];
}

function validRequest(
  value: unknown,
  userId: string,
): value is PendingPicturebookRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as PendingPicturebookRequest;
  return (
    request.userId === userId &&
    typeof request.requestId === "string" &&
    uuid.test(request.requestId) &&
    !validatePicturebookInput(request.input)
  );
}

function readRecoveryState(userId: string): RecoveryState {
  try {
    const saved = JSON.parse(
      sessionStorage.getItem(storageKey(userId)) || "null",
    );
    // Read the original one-request format as well as the recovery shelf.
    if (validRequest(saved, userId)) return { pending: saved, unconfirmed: [] };
    return {
      pending: validRequest(saved?.pending, userId) ? saved.pending : null,
      unconfirmed: Array.isArray(saved?.unconfirmed)
        ? saved.unconfirmed.filter((value: unknown) =>
            validRequest(value, userId),
          )
        : [],
    };
  } catch {
    // A blocked browser storage must not prevent creating a book.
  }
  return { pending: null, unconfirmed: [] };
}

function writeRecoveryState(userId: string, state: RecoveryState) {
  try {
    if (!state.pending && !state.unconfirmed.length)
      sessionStorage.removeItem(storageKey(userId));
    else sessionStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    // The caller retains the same recovery records in its current page state.
  }
}

export function readPendingPicturebookRequest(userId: string) {
  return readRecoveryState(userId).pending;
}

export function readUnconfirmedPicturebookRequests(userId: string) {
  return readRecoveryState(userId).unconfirmed;
}

export function savePendingPicturebookRequest(
  request: PendingPicturebookRequest,
  unconfirmed = readUnconfirmedPicturebookRequests(request.userId),
) {
  // Keep unresolved requests for this tab's lifetime. Expiring one could turn
  // a late retry into a second paid book after an ambiguous save.
  writeRecoveryState(request.userId, { pending: request, unconfirmed });
}

export function setAsidePicturebookRequest(
  request: PendingPicturebookRequest,
  unconfirmed: PendingPicturebookRequest[],
) {
  const next = [
    ...unconfirmed.filter(value => value.requestId !== request.requestId),
    request,
  ];
  // Move the record in one storage write, retaining its original input and ID.
  writeRecoveryState(request.userId, { pending: null, unconfirmed: next });
  return next;
}

export function clearPendingPicturebookRequest(
  userId: string,
  requestId: string,
  unconfirmed = readUnconfirmedPicturebookRequests(userId),
) {
  const { pending } = readRecoveryState(userId);
  // A late response must not clear a newer request from this tab.
  writeRecoveryState(userId, {
    pending: pending?.requestId === requestId ? null : pending,
    unconfirmed: unconfirmed.filter(value => value.requestId !== requestId),
  });
}

"use client";

import { useMemo, useSyncExternalStore } from "react";

import {
  emptyReadingSyncSnapshot,
  getReadingSyncEngine,
} from "@/lib/client/reading-sync";

const noop = () => {};
const subscribeEmpty = () => noop;
const getEmpty = () => emptyReadingSyncSnapshot;
const rejectWrite = () => false;

export default function useReadingSync(ownerId?: string) {
  const engine = useMemo(
    () => (ownerId ? getReadingSyncEngine(ownerId) : undefined),
    [ownerId],
  );
  const snapshot = useSyncExternalStore(
    engine?.subscribe || subscribeEmpty,
    engine?.getSnapshot || getEmpty,
    getEmpty,
  );
  return {
    ...snapshot,
    setFavorite: engine?.setFavorite || rejectWrite,
    saveProgress: engine?.saveProgress || rejectWrite,
    retry: engine?.retry || noop,
    importLegacy: engine?.importLegacy || noop,
    dismissLegacy: engine?.dismissLegacy || noop,
  };
}

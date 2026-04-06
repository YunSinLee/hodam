import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSafePersistStorage } from "@/lib/client/zustand-storage";

describe("createSafePersistStorage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses persisted JSON payload", () => {
    const getItemMock = vi.fn().mockReturnValue(
      JSON.stringify({
        state: { userInfo: { id: "user-1" } },
        version: 0,
      }),
    );
    const removeItemMock = vi.fn();

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: getItemMock,
          setItem: vi.fn(),
          removeItem: removeItemMock,
        },
      },
    });

    const storage = createSafePersistStorage<{
      userInfo: { id: string };
    }>();
    const value = storage.getItem("hodam-user-info");

    expect(getItemMock).toHaveBeenCalledWith("hodam-user-info");
    expect(value).toEqual({
      state: { userInfo: { id: "user-1" } },
      version: 0,
    });
    expect(removeItemMock).not.toHaveBeenCalled();
  });

  it("drops corrupted JSON payload instead of throwing", () => {
    const removeItemMock = vi.fn();

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: vi.fn().mockReturnValue("{broken-json"),
          setItem: vi.fn(),
          removeItem: removeItemMock,
        },
      },
    });

    const storage = createSafePersistStorage<{
      userInfo: { id: string };
    }>();
    const value = storage.getItem("hodam-user-info");

    expect(value).toBeNull();
    expect(removeItemMock).toHaveBeenCalledWith("hodam-user-info");
  });

  it("writes JSON payload safely", () => {
    const setItemMock = vi.fn();

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: vi.fn(),
          setItem: setItemMock,
          removeItem: vi.fn(),
        },
      },
    });

    const storage = createSafePersistStorage<{ bead: { count: number } }>();
    storage.setItem("hodam-bead-info", {
      state: { bead: { count: 3 } },
      version: 0,
    });

    expect(setItemMock).toHaveBeenCalledWith(
      "hodam-bead-info",
      JSON.stringify({
        state: { bead: { count: 3 } },
        version: 0,
      }),
    );
  });
});

import { describe, expect, it, vi } from "vitest";

import { ensureBeadRow } from "@/lib/server/hodam-repo";

function beadClient() {
  const read = vi.fn();
  const insertResult = vi.fn();
  const eq = vi.fn().mockReturnValue({ single: read });
  const select = vi.fn().mockReturnValue({ eq });
  const insert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ single: insertResult }),
  });
  const from = vi.fn().mockReturnValue({ select, insert });
  return { client: { from } as never, read, eq, insert, insertResult };
}

const missing = { data: null, error: { code: "PGRST116" } };
const duplicate = { code: "23505", message: "bead_user_id_key" };

describe("ensureBeadRow welcome balance", () => {
  it("inserts the fixed 10-bead welcome balance allowed by the user policy", async () => {
    const db = beadClient();
    db.read.mockResolvedValue(missing);
    db.insertResult.mockResolvedValue({
      data: { id: "bead-1", count: 10 },
      error: null,
    });

    await expect(ensureBeadRow(db.client, "user-1")).resolves.toEqual({
      id: "bead-1",
      count: 10,
    });
    expect(db.insert).toHaveBeenCalledExactlyOnceWith({
      user_id: "user-1",
      count: 10,
    });
    expect(db.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it.each([0, 4, 27])(
    "preserves an existing balance of %i without granting again",
    async count => {
      const db = beadClient();
      db.read.mockResolvedValue({
        data: { id: "existing", count },
        error: null,
      });

      await expect(ensureBeadRow(db.client, "user-1")).resolves.toEqual({
        id: "existing",
        count,
      });
      expect(db.insert).not.toHaveBeenCalled();
    },
  );

  it("recovers concurrent initialization by reading the winning row without resetting it", async () => {
    const db = beadClient();
    db.read
      .mockResolvedValueOnce(missing)
      .mockResolvedValueOnce(missing)
      .mockResolvedValueOnce({ data: { id: "winner", count: 7 }, error: null });
    db.insertResult
      .mockResolvedValueOnce({ data: { id: "winner", count: 10 }, error: null })
      .mockResolvedValueOnce({ data: null, error: duplicate });

    const results = await Promise.all([
      ensureBeadRow(db.client, "user-1"),
      ensureBeadRow(db.client, "user-1"),
    ]);

    expect(results).toEqual([
      { id: "winner", count: 10 },
      { id: "winner", count: 7 },
    ]);
    expect(db.insert).toHaveBeenCalledTimes(2);
    expect(db.read).toHaveBeenCalledTimes(3);
    expect(db.eq.mock.calls).toEqual(Array(3).fill(["user_id", "user-1"]));
  });

  it("propagates initial lookup failures without attempting a grant", async () => {
    const db = beadClient();
    const error = { code: "42501", message: "permission denied" };
    db.read.mockResolvedValue({ data: null, error });

    await expect(ensureBeadRow(db.client, "user-1")).rejects.toBe(error);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("propagates insert failures other than a unique conflict", async () => {
    const db = beadClient();
    const error = { code: "42501", message: "policy denied" };
    db.read.mockResolvedValue(missing);
    db.insertResult.mockResolvedValue({ data: null, error });

    await expect(ensureBeadRow(db.client, "user-1")).rejects.toBe(error);
    expect(db.read).toHaveBeenCalledTimes(1);
  });

  it("does not retry an insert when the concurrent row cannot be read", async () => {
    const db = beadClient();
    db.read
      .mockResolvedValueOnce(missing)
      .mockResolvedValueOnce({ data: null, error: null });
    db.insertResult.mockResolvedValue({ data: null, error: duplicate });

    await expect(ensureBeadRow(db.client, "user-1")).rejects.toBe(duplicate);
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(db.read).toHaveBeenCalledTimes(2);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import imageApi from "./image";

const { sign, bucket } = vi.hoisted(() => ({ sign: vi.fn(), bucket: vi.fn() }));
vi.mock("../utils/supabase", () => ({
  supabase: { storage: { from: bucket } },
}));

describe("private bookshelf illustration previews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bucket.mockReturnValue({ createSignedUrls: sign });
  });

  it("batches visible pages and counts a legacy first page only once", async () => {
    sign.mockResolvedValue({
      data: [
        { path: "image_thread_id_12_page_1", signedUrl: "first" },
        { path: "image_thread_id_12_page_2", error: "Object not found" },
        { path: "image_thread_id_12", signedUrl: "legacy-duplicate" },
        { path: "image_thread_id_13_page_1", error: "Object not found" },
        { path: "image_thread_id_13", signedUrl: "legacy-cover" },
      ],
      error: null,
    });
    expect(
      await imageApi.getBookPreviews([
        { threadId: 12, pageNumbers: [1, 2] },
        { threadId: 13, pageNumbers: [1] },
      ]),
    ).toEqual({
      12: { coverUrl: "first", imageCount: 1 },
      13: { coverUrl: "legacy-cover", imageCount: 1 },
    });
    expect(bucket).toHaveBeenCalledWith("image");
    expect(sign).toHaveBeenCalledExactlyOnceWith(
      [
        "image_thread_id_12_page_1",
        "image_thread_id_12_page_2",
        "image_thread_id_12",
        "image_thread_id_13_page_1",
        "image_thread_id_13",
      ],
      3600,
    );
  });

  it("does not call storage for an empty shelf", async () => {
    expect(await imageApi.getBookPreviews([])).toEqual({});
    expect(sign).not.toHaveBeenCalled();
  });

  it("propagates batch failures so the shelf can show an unknown image count", async () => {
    sign.mockResolvedValue({ data: null, error: new Error("Unavailable") });
    await expect(
      imageApi.getBookPreviews([{ threadId: 12, pageNumbers: [1] }]),
    ).rejects.toThrow("Unavailable");
  });
});

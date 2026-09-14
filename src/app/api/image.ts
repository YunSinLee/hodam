import { supabase } from "../utils/supabase";

function getImagePath(threadId: number, pageNumber?: number) {
  return pageNumber
    ? `image_thread_id_${threadId}_page_${pageNumber}`
    : `image_thread_id_${threadId}`;
}

const imageApi = {
  async saveImage({
    image_file,
    thread_id,
    page_number,
    // turn,
    // description,
  }: {
    image_file: Blob;
    thread_id: number;
    page_number?: number;
    // turn: number;
    // description: string;
  }) {
    const { data, error } = await supabase.storage
      .from("image")
      .upload(getImagePath(thread_id, page_number), image_file, {
        upsert: true,
      });

    if (error) throw error;
    if (!data) {
      throw new Error("No data returned");
    }
  },
  async getImage({
    thread_id,
    page_number,
  }: {
    thread_id: number;
    page_number?: number;
  }) {
    const { data } = await supabase.storage
      .from("image")
      .createSignedUrl(getImagePath(thread_id, page_number), 3600);

    if (data?.signedUrl) return data.signedUrl;
    if (page_number) return null;

    // Earlier releases stored covers under the owner's thread directory.
    const { data: thread } = await supabase
      .from("thread")
      .select("user_id")
      .eq("id", thread_id)
      .single();
    if (!thread?.user_id) return null;
    const directory = `${thread.user_id}/thread_${thread_id}`;
    const { data: files } = await supabase.storage
      .from("image")
      .list(directory, {
        sortBy: { column: "created_at", order: "desc" },
        limit: 1,
      });
    if (!files?.[0]) return null;
    const { data: legacy } = await supabase.storage
      .from("image")
      .createSignedUrl(`${directory}/${files[0].name}`, 3600);
    return legacy?.signedUrl ?? null;
  },
  async getPageImages({
    thread_id,
    page_numbers,
  }: {
    thread_id: number;
    page_numbers: number[];
  }) {
    const entries = await Promise.all(
      page_numbers.map(async pageNumber => {
        const imageUrl = await imageApi.getImage({
          thread_id,
          page_number: pageNumber,
        });

        if (imageUrl) {
          return [pageNumber, imageUrl] as const;
        }

        if (pageNumber === 1) {
          const legacyImageUrl = await imageApi.getImage({ thread_id });
          if (legacyImageUrl) {
            return [pageNumber, legacyImageUrl] as const;
          }
        }

        return null;
      }),
    );

    const imageUrls: Record<number, string> = Object.fromEntries(
      entries.filter(
        (entry): entry is readonly [number, string] => entry !== null,
      ),
    );
    return imageUrls;
  },
  async uploadImage(
    base64Data: string,
    thread_id: number,
    page_number?: number,
  ) {
    if (!base64Data) {
      return undefined;
    }

    const imageBlob = base64toBlob(base64Data);

    try {
      await imageApi.saveImage({
        image_file: imageBlob,
        thread_id,
        page_number,
      });

      return imageBlob;
    } catch {
      return undefined;
    }

    function base64toBlob(encodedImage: string, contentType = "image/png") {
      const byteCharacters = atob(encodedImage);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: contentType });
    }
  },
};

export default imageApi;

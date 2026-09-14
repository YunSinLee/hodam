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

    if (error) {
      console.error("Error saving image", error);
    }
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

    if (!data) {
      return null;
    }
    return data.signedUrl;
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

    return entries.reduce<Record<number, string>>((imageUrls, entry) => {
      if (entry) {
        imageUrls[entry[0]] = entry[1];
      }
      return imageUrls;
    }, {});
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
    } catch (error) {
      console.error("이미지 업로드 중 오류 발생:", error);
      return undefined;
    }

    function base64toBlob(base64Data: string, contentType = "image/png") {
      const byteCharacters = atob(base64Data);
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

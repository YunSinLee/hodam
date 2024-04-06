import { supabase } from "../utils/supabase";

const imageApi = {
  async saveImage({
    image_file,
    thread_id,
    // turn,
    // description,
  }: {
    image_file: Blob;
    thread_id: number;
    // turn: number;
    // description: string;
  }) {
    const { data, error } = await supabase.storage
      .from("image")
      .upload(`image_thread_id_${thread_id}`, image_file);

    if (error) {
      console.error("Error saving image", error);
    }
    if (!data) {
      throw new Error("No data returned");
    }
  },
  async getImage({ thread_id }: { thread_id: number }) {
    const { data } = await supabase.storage
      .from("image")
      .createSignedUrl(`image_thread_id_${thread_id}`, 3600);

    if (!data) {
      return null;
    }
    return data.signedUrl;
  },
  async uploadImage(base64Data: string, thread_id: number) {
    const imageBlob = base64toBlob(base64Data);

    try {
      await imageApi.saveImage({
        image_file: imageBlob,
        thread_id: thread_id,
      });

      return imageBlob;
    } catch (error) {
      console.error("이미지 업로드 중 오류 발생:", error);
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

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
    console.log("image_url", image_file);
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
};

export default imageApi;

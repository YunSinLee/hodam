import { supabase } from "../utils/supabase";
import type { Image } from "../types/openai";

const imageApi = {
  async saveImage({
    image_url,
    thread_id,
    turn,
    description,
  }: {
    image_url: string;
    thread_id: number;
    turn: number;
    description: string;
  }): Promise<Image> {
    const { data, error } = await supabase
      .from("image")
      .insert({
        image_url,
        thread_id,
        turn,
        description,
      })
      .select();

    if (error) {
      console.error("Error saving image", error);
    }
    if (!data) {
      throw new Error("No data returned");
    }

    return data[0] as Image;
  },
};

export default imageApi;

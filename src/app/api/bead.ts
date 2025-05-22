import type { Bead } from "@/services/hooks/use-bead";
import { supabase } from "../utils/supabase";

const beadApi = {
  async initializeBead(user_id: string) {
    const hasBead = await hasBeadAlready();

    if (!hasBead) {
      const { data, error } = await supabase
        .from("bead")
        .insert({ user_id })
        .select();

      if (error) {
        console.error("Error initializing bead", error);
      }

      return data![0] as Bead;
    }
    const { data, error } = await supabase
      .from("bead")
      .select()
      .eq("user_id", user_id);

    if (error) {
      console.error("Error getting bead", error);
    }

    return data![0] as Bead;

    async function hasBeadAlready() {
      const { data, error } = await supabase
        .from("bead")
        .select()
        .eq("user_id", user_id);

      if (error) {
        console.error("Error getting bead", error);
      }

      if (data && data.length > 0) {
        return true;
      }
      return false;
    }
  },

  async updateBeadCount(user_id: string, count: number) {
    const { data, error } = await supabase
      .from("bead")
      .update({ count })
      .eq("user_id", user_id)
      .select();

    if (error) {
      console.error("Error updating bead count", error);
    }
    return data![0] as Bead;
  },
};

export default beadApi;

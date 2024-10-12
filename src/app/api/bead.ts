import type { Bead } from "@/services/hooks/use-bead";
import { supabase } from "../utils/supabase";

const beadApi = {
  async initializeBead(user_id: string) {
    const hasBead = await _hasBead();

    if (!hasBead) {
      const { data, error } = await supabase
        .from("bead")
        .insert({ user_id })
        .select();

      if (error) {
        console.error("Error initializing bead", error);
      }

      return data![0] as Bead;
    } else {
      const { data, error } = await supabase
        .from("bead")
        .select()
        .eq("user_id", user_id);

      if (error) {
        console.error("Error getting bead", error);
      }

      return data![0] as Bead;
    }

    async function _hasBead() {
      const { data, error } = await supabase
        .from("bead")
        .select()
        .eq("user_id", user_id);

      if (error) {
        console.error("Error getting bead", error);
      }

      if (data && data.length > 0) {
        return true;
      } else return false;
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

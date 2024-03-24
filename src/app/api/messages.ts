import { supabase } from "../utils/supabase";
import type { Message, MessagePair, Selection } from "../types/openai";

const messagesApi = {
  async saveMessages({
    messages,
    thread_id,
    turn,
  }: {
    messages: MessagePair[];
    thread_id: number;
    turn: number;
  }): Promise<Message[]> {
    for (const message of messages) {
      const { error } = await supabase
        .from("messages")
        .insert({
          message: message.korean,
          message_en: message.english,
          thread_id,
          turn,
        })
        .select();

      if (error) {
        console.error("Error saving message", error);
      }
    }

    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("thread_id", thread_id)
      .eq("turn", turn);

    return data as Message[];
  },
  async saveSelections({
    selections,
    thread_id,
    turn,
  }: {
    selections: MessagePair[];
    thread_id: number;
    turn: number;
  }): Promise<Selection[]> {
    for (const selection of selections) {
      const { error } = await supabase
        .from("selections")
        .insert({
          selection: selection.korean,
          selection_en: selection.english,
          thread_id,
          turn,
        })
        .select();

      if (error) {
        console.error("Error saving selection", error);
      }
    }

    const { data } = await supabase
      .from("selections")
      .select("*")
      .eq("thread_id", thread_id)
      .eq("turn", turn);

    return data as Selection[];
  },
  // async saveMessages({
  //   messages,
  //   thread_id,
  //   turn,
  // }: {
  //   messages: string[];
  //   thread_id: number;
  //   turn: number;
  // }): Promise<Message[]> {
  //   for (const message of messages) {
  //     const { error } = await supabase
  //       .from("messages")
  //       .insert({ message, thread_id, turn })
  //       .select();

  //     if (error) {
  //       console.error("Error saving message", error);
  //     }
  //   }

  //   const { data } = await supabase
  //     .from("messages")
  //     .select("*")
  //     .eq("thread_id", thread_id)
  //     .eq("turn", turn);

  //   return data as Message[];
  // },
  async fetchMessages({
    thread_ids,
  }: {
    thread_ids: number[];
  }): Promise<Record<number, Message[]>> {
    const { data } = await supabase
      .from("messages")
      .select()
      .in("thread_id", thread_ids);

    if (!data) return {};
    const groupedByThreadId: Record<number, Message[]> = data.reduce(
      (acc, message) => {
        if (!acc[message.thread_id]) {
          acc[message.thread_id] = [];
        }
        acc[message.thread_id].push(message);
        return acc;
      },
      {},
    );

    for (const threadId in groupedByThreadId) {
      groupedByThreadId[threadId].sort((a, b) => a.id - b.id);
    }

    return groupedByThreadId;
  },
};

export default messagesApi;

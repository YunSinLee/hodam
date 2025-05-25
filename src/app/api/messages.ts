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

  /**
   * 메시지의 영어 번역을 업데이트하는 메서드
   * @param messages 업데이트할 메시지 배열
   * @returns 업데이트된 메시지 배열
   */
  async updateMessagesWithTranslation(
    messages: {
      message: string;
      message_en: string;
      turn: number;
      thread_id: number;
      position: number;
    }[],
  ): Promise<any[]> {
    const results = [];

    for (const message of messages) {
      // 데이터베이스에서 해당 메시지를 찾아 업데이트
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("thread_id", message.thread_id)
        .eq("turn", message.turn)
        .order("id", { ascending: true });

      if (error) {
        console.error("Error finding message to update translation", error);
        continue;
      }

      if (!data || data.length === 0) {
        console.error("No messages found to update translation");
        continue;
      }

      // position에 해당하는 메시지 찾기
      const targetMessage = data[message.position];
      if (!targetMessage) {
        console.error(`No message found at position ${message.position}`);
        continue;
      }

      // 영어 번역 업데이트
      const { data: updatedData, error: updateError } = await supabase
        .from("messages")
        .update({ message_en: message.message_en })
        .eq("id", targetMessage.id)
        .select();

      if (updateError) {
        console.error("Error updating message translation", updateError);
      } else if (updatedData) {
        results.push(updatedData[0]);
      }
    }

    return results;
  },
};

export default messagesApi;

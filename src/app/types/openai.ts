export interface Thread {
  id: number;
  openai_thread_id: string;
  created_at: string;
}

export interface Message {
  id: number;
  thread_id: number;
  created_at: string;
  order: number;
  message: string;
}

export interface Keyword {
  id: number;
  thread_id: number;
  keyword: string;
}

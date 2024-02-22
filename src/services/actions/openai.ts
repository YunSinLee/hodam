"use server";

import openAI from "openai";

const OPEN_AI_API_KEY = process.env.OPEN_AI_API_KEY;

const openai = new openAI({
  apiKey: OPEN_AI_API_KEY,
});

export async function getResponse(keyword: string) {
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content:
          "You are given keywords, and your job is to create a fairy tale from them.",
      },
      {
        role: "user",
        // "content": "Black-on-black ware is a 20th- and 21st-century pottery tradition developed by the Puebloan Native American ceramic artists in Northern New Mexico. Traditional reduction-fired blackware has been made for centuries by pueblo artists. Black-on-black ware of the past century is produced with a smooth surface, with the designs applied through selective burnishing or the application of refractory slip. Another style involves carving or incising designs and selectively polishing the raised areas. For generations several families from Kha'po Owingeh and P'ohwhóge Owingeh pueblos have been making black-on-black ware with the techniques passed down from matriarch potters. Artists from other pueblos have also produced black-on-black ware. Several contemporary artists have created works honoring the pottery of their ancestors."
        content: keyword,
      },
    ],
    temperature: 0.5,
    max_tokens: 100,
    top_p: 1,
  });

  return response;
}

export async function createThread() {
  const thread = await openai.beta.threads.create();

  return thread;
}

export async function addMessageToThread(threadId: string, message: string) {
  const response = await openai.beta.threads.messages.create(threadId, {
    role: "user",
    content: message,
  });

  return response;
}

export async function run(threadId: string) {
  const run = await openai.beta.threads.runs.create(threadId, {
    assistant_id: "asst_BFn9OJqLE0CcW1A4Jq9n8Vqv",
  });

  return run;
}

export async function retrieveRun(threadId: string, runId: string) {
  const run = await openai.beta.threads.runs.retrieve(threadId, runId);

  return run;
}

export async function getText(threadId: string) {
  const messages = await openai.beta.threads.messages.list(threadId);
  console.log("messages", messages.data[0].content[0].text.value);

  return messages.data[0].content[0].text.value;
}

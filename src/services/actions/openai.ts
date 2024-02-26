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
    assistant_id: "asst_R9N7jpLS8FrppgKTyyzclhB1",
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

export async function getExtractedText(threadId: string) {
  const messages = await openai.beta.threads.messages.list(threadId);

  return extractLists(messages.data[0].content[0].text.value);
}

export async function createImage(prompt: string) {
  const style =
    "너가 그려준 그림을 이용해서 동화책을 만들거야. 동화책을 읽을 사람은 3살에서 7살 정도의 어린이야. 애니메이션 같은 그림으로 그려줬으면 좋겠어. 이제 너가 그려야 할 그림에 대해 설명해줄게. ";
  const promptAddedStyle = style + prompt;
  console.log("promptAddedStyle", promptAddedStyle);
  const response = await openai.images.generate({
    prompt: promptAddedStyle,
    model: "dall-e-3",
    n: 1,
    response_format: "url",
    size: "1024x1024",
  });
  console.log("response", response);

  return response;
}

function extractListItems(content: string) {
  const itemRegex = /<li>(.*?)<\/li>/gs;
  const matches = content.matchAll(itemRegex);
  const items = Array.from(matches, match => ({ text: match[1] }));
  return items;
}

function extractLists(data: string) {
  const ulRegex = /<ul>(.*?)<\/ul>/s;
  const olRegex = /<ol>(.*?)<\/ol>/s;
  const pRegex = /<p>(.*?)<\/p>/gs;

  const ulMatch = data.match(ulRegex);
  const olMatch = data.match(olRegex);
  const pMatches = data.matchAll(pRegex);

  const ulContent = ulMatch ? ulMatch[1] : "";
  const olContent = olMatch ? olMatch[1] : "";
  const pContents = Array.from(pMatches, match => match[1]);

  const ulItems = extractListItems(ulContent);
  const olItems = extractListItems(olContent);

  return { ulItems, olItems, pContents };
}

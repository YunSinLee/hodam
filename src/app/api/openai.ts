"use server";

import openAI from "openai";
import type { StoryContent, MessagePair } from "@/app/types/openai";

// eslint-disable-next-line prefer-destructuring
const OPEN_AI_API_KEY = process.env.OPEN_AI_API_KEY;

// eslint-disable-next-line new-cap
const openai = new openAI({
  apiKey: OPEN_AI_API_KEY,
});

const assistantIds = {
  default: "asst_R9N7jpLS8FrppgKTyyzclhB1",
  traditional: "asst_ixhqsGqYTN4WUNY1cjwumVoH",
};

// export async function getResponse(keyword: string) {
//   const response = await openai.chat.completions.create({
//     model: "gpt-3.5-turbo",
//     messages: [
//       {
//         role: "system",
//         content:
//           "You are given keywords, and your job is to create a fairy tale from them.",
//       },
//       {
//         role: "user",
//         // "content": "Black-on-black ware is a 20th- and 21st-century pottery tradition developed by the Puebloan Native American ceramic artists in Northern New Mexico. Traditional reduction-fired blackware has been made for centuries by pueblo artists. Black-on-black ware of the past century is produced with a smooth surface, with the designs applied through selective burnishing or the application of refractory slip. Another style involves carving or incising designs and selectively polishing the raised areas. For generations several families from Kha'po Owingeh and P'ohwhóge Owingeh pueblos have been making black-on-black ware with the techniques passed down from matriarch potters. Artists from other pueblos have also produced black-on-black ware. Several contemporary artists have created works honoring the pottery of their ancestors."
//         content: keyword,
//       },
//     ],
//     temperature: 0.5,
//     max_tokens: 100,
//     top_p: 1,
//   });

//   return response;
// }

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

export async function run(threadId: string, assistantType: string = "default") {
  const result = await openai.beta.threads.runs.create(threadId, {
    assistant_id: assistantIds[assistantType as keyof typeof assistantIds],
  });

  return result;
}

export async function retrieveRun(threadId: string, runId: string) {
  const result = await openai.beta.threads.runs.retrieve(threadId, runId);

  return result;
}

export async function getExtractedText(threadId: string) {
  const messages = await openai.beta.threads.messages.list(threadId);

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  return extractStoryContentFromHTML(messages.data[0].content[0].text.value);
}

export async function createImage(prompt: string) {
  const style =
    "너가 그려준 그림을 이용해서 동화책을 만들거야. 동화책을 읽을 사람은 3살에서 7살 정도의 어린이야. 애니메이션 같은 그림으로 그려줬으면 좋겠어. 이제 너가 그려야 할 그림에 대해 설명해줄게. ";
  const promptAddedStyle = style + prompt;
  const response = await openai.images.generate({
    prompt: promptAddedStyle,
    model: "dall-e-3",
    n: 1,
    response_format: "b64_json",
    size: "1024x1024",
  });

  return response;
}

export async function extractStoryContentFromHTML(
  htmlString: string,
): Promise<StoryContent> {
  // 섹션별로 HTML 문자열 분리
  // 섹션별로 HTML 문자열 분리
  const messagesSectionMatch = htmlString.match(
    /<ul class="messages">([\s\S]*?)<\/ul>/,
  );
  const selectionsSectionMatch = htmlString.match(
    /<ol class="selections">([\s\S]*?)<\/ol>/,
  );

  // 동화내용 추출
  const messages: MessagePair[] = [];
  if (messagesSectionMatch) {
    const messagesHtml = messagesSectionMatch[1];
    const messageRegex =
      /<li class="korean">(.+?)<\/li>(\s*<li class="english">(.+?)<\/li>)?/g;
    let messageMatch;
    // eslint-disable-next-line no-cond-assign
    while ((messageMatch = messageRegex.exec(messagesHtml)) !== null) {
      messages.push({
        korean: messageMatch[1],
        english: messageMatch[3] || "", // 영어 메시지가 없으면 빈 문자열 사용
      });
    }
  }

  // 선택지 추출
  const selections: MessagePair[] = [];
  if (selectionsSectionMatch) {
    const selectionsHtml = selectionsSectionMatch[1];
    const selectionRegex =
      /<li class="korean">(.+?)<\/li>(\s*<li class="english">(.+?)<\/li>)?/g;
    let selectionMatch;
    // eslint-disable-next-line no-cond-assign
    while ((selectionMatch = selectionRegex.exec(selectionsHtml)) !== null) {
      selections.push({
        korean: selectionMatch[1],
        english: selectionMatch[3] || "", // 영어 선택지가 없으면 빈 문자열 사용
      });
    }
  }

  // 안내메시지 추출
  const noticeRegex = /<p class="notice">(.+?)<\/p>/;
  const noticeMatch = noticeRegex.exec(htmlString);
  const notice = noticeMatch ? noticeMatch[1] : "";

  // 이미지 설명 추출
  const imageDescriptionRegex = /<p class="image">(.+?)<\/p>/;
  const imageDescriptionMatch = imageDescriptionRegex.exec(htmlString);
  const imageDescription = imageDescriptionMatch
    ? imageDescriptionMatch[1]
    : "";

  return {
    rawText: htmlString,
    messages,
    selections,
    notice,
    imageDescription,
  };
}

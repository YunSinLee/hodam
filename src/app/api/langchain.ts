"use server";

import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { OpenAI } from "openai";

const { OPEN_AI_API_KEY } = process.env;

// 동화 생성을 위한 챗 모델 초기화 (높은 temperature로 창의성 향상)
const chatModel = new ChatOpenAI({
  apiKey: OPEN_AI_API_KEY,
  modelName: "gpt-3.5-turbo",
  temperature: 0.75,
});

// OpenAI 클라이언트 (DALL-E 이미지 생성용)
const openaiClient = new OpenAI({
  apiKey: OPEN_AI_API_KEY,
});

// 시스템 프롬프트 - 호담 역할 정의
const HODAM_SYSTEM_PROMPT = `당신은 '호담(Hodam)'이라는 어린이 동화 생성 AI입니다. 
어린이들을 위한 매혹적이고 도덕적 교훈이 담긴 이야기를 만듭니다.

1. 매혹적이고 교훈적인 어린이 이야기 생성: 어린이들을 대상으로 하는 이야기를 만들어야 합니다. 이야기는 교훈과 흥미로운 모험을 포함해야 합니다.

2. 서사적 선택지 제공: 각 이야기 부분의 끝에는 세 가지 서사적 선택지를 제공합니다. 이 선택지들은 아이들이 이야기의 방향을 결정할 수 있게 해줍니다.

3. 아동 친화적인 서술 방식: 서사적 선택지는 일관되게 "~~해요"라는 형식으로 구성합니다. 이는 어린이 친화적이고 몰입감 있는 접근 방식입니다.

4. 다음 HTML 형식을 정확히 준수해야 합니다:
<ul class="messages">
  <li class="korean">동화 내용 첫 번째 문단</li>
  <li class="korean">동화 내용 두 번째 문단</li>
  <li class="korean">동화 내용 세 번째 문단</li>
</ul>

<p class="notice">이야기의 결말 또는 교훈 안내 메시지</p>

<ol class="selections">
  <li class="korean">다음 전개 선택지 1</li>
  <li class="korean">다음 전개 선택지 2</li>
  <li class="korean">다음 전개 선택지 3</li>
</ol>

5. 창의성: 주어진 키워드를 최대한 창의적으로 활용하여 매력적인 이야기를 만들어야 합니다. 동일한 패턴의 이야기를 반복하지 말고, 다양한 플롯과 캐릭터를 만들어보세요.

6. 선택지 다양성: 세 개의 선택지는 서로 다른 방향성을 가져야 합니다:
   - 첫 번째: 용감하고 적극적인 선택
   - 두 번째: 신중하고 지혜로운 선택  
   - 세 번째: 창의적이고 독특한 선택`;

// 동화 생성을 위한 프롬프트 템플릿 (개선됨)
const fairyTalePromptTemplate = PromptTemplate.fromTemplate(`
다음 키워드를 사용하여 어린이를 위한 교훈적이고 창의적인 이야기를 만들어주세요:
{keywords}

이야기는 한국어로 작성하고, 다음 형식에 맞추어 HTML로 반환해주세요:
<ul class="messages">
  <li class="korean">동화 내용 첫 번째 문단</li>
  <li class="korean">동화 내용 두 번째 문단</li>
  (동화 내용 계속)
</ul>

<p class="notice">이야기의 다음 전개를 어떻게 할지 안내하는 메시지</p>

<ol class="selections">
  <li class="korean">다음 전개 선택지 1 (용감하고 적극적인 선택)</li>
  <li class="korean">다음 전개 선택지 2 (신중하고 지혜로운 선택)</li>
  <li class="korean">다음 전개 선택지 3 (창의적이고 독특한 선택)</li>
</ol>

중요: 반드시 3개의 서로 다른 성격의 선택지를 제공해주세요.
`);

// 키워드에서 동화를 생성하는 체인
const _fairyTaleChain = RunnableSequence.from([
  fairyTalePromptTemplate,
  chatModel,
  new StringOutputParser(),
]);

// 전체 대화 기록을 사용하는 체인
const _chatHistoryChain = async (
  messages: (HumanMessage | AIMessage | SystemMessage)[],
  input: string,
) => {
  // 시스템 메시지가 없는 경우 추가
  if (messages.length === 0 || !(messages[0] instanceof SystemMessage)) {
    messages.unshift(new SystemMessage(HODAM_SYSTEM_PROMPT));
  }

  // 사용자 입력 추가
  messages.push(new HumanMessage(input));

  // 모델 호출
  const response = await chatModel.invoke(messages);

  // AI 응답 추가 및 반환
  messages.push(response);
  return {
    response: response.content as string,
    messages,
  };
};

interface FairyTaleResponse {
  storyHtml: string;
  messages?: (HumanMessage | AIMessage | SystemMessage)[];
}

/**
 * 키워드를 입력받아 동화를 생성하는 함수
 * @param keywords 동화에 포함할 키워드 목록 (쉼표로 구분)
 * @returns 생성된 동화 HTML 문자열
 */
export async function generateFairyTale(
  keywords: string,
): Promise<FairyTaleResponse> {
  try {
    // 대화 기록 초기화
    const messages: (HumanMessage | AIMessage | SystemMessage)[] = [
      new SystemMessage(HODAM_SYSTEM_PROMPT),
      new HumanMessage(
        `다음 키워드로 재미있고 교훈적인 동화를 만들어주세요: ${keywords}`,
      ),
    ];

    // 모델 호출
    const response = await chatModel.invoke(messages);
    const storyHtml = response.content as string;

    return {
      storyHtml,
      messages: [...messages, response],
    };
  } catch (error) {
    console.error("Error generating fairy tale:", error);
    throw error;
  }
}

/**
 * 동화 내용을 바탕으로 다음 전개를 생성하는 함수
 * @param storyContext 지금까지의 동화 내용
 * @param selection 사용자가 선택한 전개 방향
 * @param previousMessages 이전 대화 기록
 * @returns 다음 전개의 동화 HTML 문자열
 */
export async function generateNextPart(
  storyContext: string,
  selection: string,
  previousMessages: (HumanMessage | AIMessage | SystemMessage)[] = [],
): Promise<FairyTaleResponse> {
  try {
    // 대화 기록이 없는 경우 초기화
    let messages = [...previousMessages];
    if (messages.length === 0) {
      messages = [new SystemMessage(HODAM_SYSTEM_PROMPT)];
    }

    // 선택 추가
    messages.push(
      new HumanMessage(
        `사용자가 다음 선택지를 골랐습니다: "${selection}"\n\n이 선택에 따라 이야기를 계속 진행해주세요.`,
      ),
    );

    // 모델 호출
    const response = await chatModel.invoke(messages);
    const storyHtml = response.content as string;

    return {
      storyHtml,
      messages: [...messages, response],
    };
  } catch (error) {
    console.error("Error generating next part:", error);
    throw error;
  }
}

/**
 * 동화를 영어로 번역하는 함수
 * @param koreanStory 한국어 동화 내용
 * @returns 영어로 번역된 동화 내용
 */
export async function translateToEnglish(koreanStory: string): Promise<string> {
  const translationPrompt = PromptTemplate.fromTemplate(`
다음 한국어 동화를 영어로 번역해주세요. 번역은 아이들이 이해하기 쉬운 영어로 작성해주세요.
번역 시 원문의 뉘앙스를 최대한 유지하고, 아동 친화적인 단어와 표현을 사용해주세요.

한국어 동화:
{koreanStory}
`);

  const translationChain = RunnableSequence.from([
    translationPrompt,
    chatModel,
    new StringOutputParser(),
  ]);

  try {
    return await translationChain.invoke({
      koreanStory,
    });
  } catch (error) {
    console.error("Error translating fairy tale:", error);
    throw error;
  }
}

/**
 * 영어 번역을 HTML 형식에 맞게 통합하는 함수
 * @param koreanHtml 한국어 동화 HTML
 * @param englishTranslation 영어 번역 텍스트
 * @returns 한국어와 영어가 번갈아 나오는 HTML
 */
export async function integrateEnglishTranslation(
  koreanHtml: string,
  englishTranslation: string,
): Promise<string> {
  // 시스템 프롬프트
  const systemPrompt = `당신은 HTML 문서에 영어 번역을 통합하는 전문가입니다. 
주어진 한국어 HTML 동화와 영어 번역을 받아, 다음과 같은 형식으로 변환해야 합니다:

<ul class="messages">
  <li class="korean">[한국어 문단 1]</li>
  <li class="english">[영어 번역 문단 1]</li>
  <li class="korean">[한국어 문단 2]</li>
  <li class="english">[영어 번역 문단 2]</li>
  ...
</ul>

<p class="notice">[한국어 안내 메시지]</p>

<ol class="selections">
  <li class="korean">[한국어 선택지 1]</li>
  <li class="english">[영어 선택지 1]</li>
  <li class="korean">[한국어 선택지 2]</li>
  <li class="english">[영어 선택지 2]</li>
  ...
</ol>

<p class="image">[기존 이미지 설명 유지]</p>

한국어 내용은 그대로 유지하고, 적절한 위치에 영어 번역을 삽입하세요.`;

  try {
    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(
        `한국어 HTML:\n${koreanHtml}\n\n영어 번역:\n${englishTranslation}`,
      ),
    ];

    const response = await chatModel.invoke(messages);
    return response.content as string;
  } catch (error) {
    console.error("Error integrating English translation:", error);
    throw error;
  }
}

/**
 * 동화 내용을 바탕으로 이미지를 생성하는 함수
 * @param storyContent 동화 내용 (실제 동화 텍스트)
 * @returns 생성된 이미지 데이터
 */
export async function generateImage(storyContent: string) {
  try {
    // 동화 내용에서 이미지 생성을 위한 프롬프트 생성
    const imagePromptTemplate = PromptTemplate.fromTemplate(`
You are an expert in creating illustrations for children's storybooks.
Read the following Korean fairy tale content and select the most important and visually appealing scene to create a detailed description for generating a vibrant children's storybook illustration for ages 3-7.

Korean Fairy Tale Content:
{storyContent}

Illustration Generation Guidelines:
1. Select the most important and visually appealing scene from the story
2. Clearly express the characteristics and emotions of the characters
3. Describe the background and environment in detail
4. Use bright and vivid colors
5. Simple and easy-to-understand composition
6. Friendly and cute character style
7. Child-friendly expressions
8. Warm and cozy atmosphere
9. Reflect the core message or lesson of the story

Please analyze the fairy tale content according to the above guidelines, select the most suitable scene, and write a detailed and specific image generation prompt.

IMPORTANT: Respond ONLY in English. Do not include any Korean text in your response.

Response Format:
Selected Scene: [Description of the key scene selected from the fairy tale]
Image Prompt: [Detailed English prompt for DALL-E]
`);

    // 이미지 프롬프트 생성 체인 실행
    const imagePromptChain = RunnableSequence.from([
      imagePromptTemplate,
      chatModel,
      new StringOutputParser(),
    ]);

    // 동화 내용 기반 프롬프트 생성
    const promptResponse = await imagePromptChain.invoke({
      storyContent,
    });

    console.log("AI Response:", promptResponse);

    // 응답에서 실제 이미지 프롬프트 추출
    let imagePrompt = promptResponse;
    const promptMatch = promptResponse.match(/Image Prompt:\s*([\s\S]+)/);
    if (promptMatch && promptMatch[1]) {
      imagePrompt = promptMatch[1].trim();
    }

    // 한국어가 포함되어 있는지 확인하고 제거
    const koreanRegex = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g;
    if (koreanRegex.test(imagePrompt)) {
      console.warn("Korean text detected in image prompt, using fallback");
      // 한국어가 포함된 경우 기본 프롬프트 사용
      imagePrompt =
        "A cheerful children's storybook illustration featuring friendly characters in a warm, colorful setting with simple composition and bright colors";
    }

    // 어린이 동화책 스타일 강화를 위한 추가 프롬프트
    const enhancedPrompt = `Children's storybook illustration, vibrant colors, friendly characters, warm atmosphere, simple composition, ${imagePrompt}`;

    // 프롬프트 길이 제한 (DALL-E 제한사항)
    const finalPrompt =
      enhancedPrompt.length > 1000
        ? enhancedPrompt.substring(0, 1000)
        : enhancedPrompt;

    console.log("Final image prompt:", finalPrompt);

    // DALL-E로 이미지 생성
    const response = await openaiClient.images.generate({
      prompt: finalPrompt,
      model: "dall-e-3",
      n: 1,
      response_format: "b64_json",
      size: "1024x1024",
    });

    return response;
  } catch (error) {
    console.error("Error generating image:", error);

    // 오류 발생 시 기본 이미지 프롬프트로 재시도
    try {
      console.log("Retrying with fallback prompt...");
      const fallbackPrompt =
        "A beautiful children's storybook illustration with friendly cartoon characters, bright colors, simple composition, warm and cheerful atmosphere, suitable for ages 3-7";

      const response = await openaiClient.images.generate({
        prompt: fallbackPrompt,
        model: "dall-e-3",
        n: 1,
        response_format: "b64_json",
        size: "1024x1024",
      });

      return response;
    } catch (fallbackError) {
      console.error("Fallback image generation also failed:", fallbackError);
      throw error; // 원래 오류를 던짐
    }
  }
}

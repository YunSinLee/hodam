import "server-only";

import { OpenAI } from "openai";

import { requireServerUser } from "./server-auth";
import {
  parsePicturebookDraft,
  validatePicturebookInput,
} from "../utils/picturebook";

import type {
  PicturebookChoice,
  PicturebookChoiceOption,
  PicturebookDraft,
  PicturebookEmotionalBeat,
  PicturebookInput,
  PicturebookPage,
} from "../types/openai";

const OPEN_AI_API_KEY =
  process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY;

const openaiClient = new OpenAI({
  apiKey: OPEN_AI_API_KEY || "not-configured",
  timeout: 60000,
  maxRetries: 0,
});

export class GenerationError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "GenerationError";
  }
}

function generationError(cause: unknown, fallback: string): GenerationError {
  if (cause instanceof GenerationError) return cause;
  if (isRecord(cause)) {
    if (
      cause.code === "credit_balance_exhausted" ||
      cause.code === "insufficient_quota" ||
      cause.type === "insufficient_quota"
    )
      return new GenerationError(
        "이야기 생성 서비스의 이용 한도가 소진됐어요. 운영팀에 문의해주세요.",
        false,
      );
    if (cause.status === 401 || cause.status === 403)
      return new GenerationError(
        "이야기 생성 서비스에 연결할 수 없어요. 운영팀에 문의해주세요.",
        false,
      );
    if (cause.status === 429)
      return new GenerationError(
        "생성 요청이 몰리고 있어요. 잠시 후 다시 시도해주세요.",
        true,
      );
  }
  return new GenerationError(fallback, true);
}

async function invokeStoryModel(prompt: string) {
  if (!OPEN_AI_API_KEY)
    throw new GenerationError(
      "이야기 생성 서비스에 연결할 수 없어요. 운영팀에 문의해주세요.",
      false,
    );
  const response = await openaiClient.chat.completions.create({
    model: process.env.OPENAI_STORY_MODEL || "gpt-4o-mini",
    temperature: 0.75,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: PICTUREBOOK_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  });
  const content = response.choices[0]?.message.content;
  if (!content) throw new Error("이야기 응답이 비어 있어요.");
  if (response.choices[0]?.finish_reason !== "stop")
    throw new Error("이야기 응답이 끝까지 도착하지 않았어요.");
  return { content };
}

const PICTUREBOOK_SYSTEM_PROMPT = `당신은 호담(Hodam)의 수석 잠자리 그림책 작가입니다.
부모가 입력한 아이의 실제 하루를 3-12세 아이에게 오늘 밤 바로 읽어줄 수 있는 8쪽 맞춤 그림책으로 바꿉니다.

제품 기준:
1. 핵심 가치는 "부모가 실제로 읽어줄 만한 이야기"입니다. 설명문, 상담문, 훈계문이 아니라 그림책이어야 합니다.
2. 아이의 문제 행동을 비난하지 않습니다. 먼저 장면과 감정을 보여주고, 작은 시도로 자연스럽게 이동합니다.
3. 교훈을 직접 말하지 않습니다. "해야 해", "중요해", "배웠어요" 같은 문장 대신 장면과 행동으로 느끼게 합니다.
4. 각 쪽은 장면, 행동, 감각 중 최소 두 가지를 담습니다. 손, 불빛, 이불, 냄새, 소리, 표정 같은 구체물이 있어야 합니다.
5. 문장은 부모가 잠자리에서 읽는 짧고 리듬 있는 한국어입니다. 한 쪽은 2-3문장, 한 문장은 길게 늘이지 않습니다.
6. 선택지는 교훈 선택이 아니라 다음 장면에서 주인공이 해볼 작은 행동입니다. 선택지는 한 번만 나오고, 선택 후에는 8쪽까지 완결합니다.
7. 반드시 유효한 JSON만 반환합니다. 마크다운 코드블록, 설명 문장, HTML을 넣지 않습니다.`;

const PICTUREBOOK_STYLE_RULES = `
문체 규칙:
- 상담실 조언처럼 쓰지 말고, 그림책 장면처럼 씁니다.
- "속상했다"만 말하지 말고 손, 눈, 숨, 방 안의 소리로 감정을 보여줍니다.
- "괜찮아"를 남발하지 말고, 작은 행동 뒤에 몸이 풀리는 장면을 보여줍니다.
- 부모 대사는 한 쪽에 한 문장 이하로 짧게 둡니다.
- 결말은 잠자리의 이불, 낮은 목소리, 작은 숨, 어두워지는 방처럼 닫힙니다.
- 아이 이름을 과하게 반복하지 않습니다.
- 영어, HTML, 이모지, 괄호 설명을 쓰지 않습니다.`;

const PICTUREBOOK_CHOICE_RULES = `
선택지 규칙:
- choice.options 3개는 모두 주인공이 다음 장면에서 직접 해볼 작은 행동이어야 합니다.
- labelKo는 짧은 한국어 문장으로 쓰고 반드시 "~요" 말투로 끝냅니다.
- "양치를 시작해보기", "말해본다"처럼 제목이나 설명형으로 쓰지 않습니다.
- 문제를 유지하거나 피하는 행동은 선택지로 쓰지 않습니다. 예: 더 꽉 잡기, 계속 빼앗기, 숨어 있기, 안 하기.
- 각 선택지는 손 내밀기, 작게 말하기, 숨 고르기, 함께 놓아보기처럼 그림으로 보이는 행동이어야 합니다.
- resolutionHint는 그 행동이 5-8쪽 장면에서 어떻게 작게 풀리는지 씁니다.`;

const PICTUREBOOK_START_ARC = `
1쪽: 오늘의 실제 장면. 입력된 상황이 그림책 장면으로 바로 보이게 씁니다.
2쪽: 아이의 감정 구체화. 감정을 이름 붙이기보다 몸짓과 작은 생각으로 보여줍니다.
3쪽: 작은 상상 장치 또는 그림책적 은유 등장. 아이 마음을 돕는 부드러운 상징을 만듭니다.
4쪽: 아이가 선택하는 순간. 다음 장면에서 해볼 작은 행동 3가지를 선택지로 둡니다.`;

const PICTUREBOOK_ENDING_ARC = `
5쪽: 선택한 행동을 아주 작은 시도로 옮깁니다.
6쪽: 작은 어려움 또는 망설임이 한 번 더 옵니다.
7쪽: 감정이 풀리는 장면을 행동과 감각으로 보여줍니다.
8쪽: 잠자리에서 닫히는 따뜻한 결말로 마무리합니다.`;

function getAgeBand(childAge: string): "3-4" | "5-7" | "8+" {
  const age = Number.parseInt(childAge, 10);
  if (Number.isNaN(age)) return "5-7";
  if (age <= 4) return "3-4";
  if (age <= 7) return "5-7";
  return "8+";
}

function stripJsonFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseJsonObject(value: string): unknown {
  return JSON.parse(stripJsonFence(value));
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isActionChoiceLabel(value: string) {
  const label = value.trim();
  return (
    label.length >= 6 &&
    label.length <= 40 &&
    (label.endsWith("요") || label.endsWith("요.")) &&
    !blockedChoiceTerms.some(term => label.includes(term))
  );
}

const allowedPicturebookBeats: PicturebookEmotionalBeat[] = [
  "setup",
  "tension",
  "choice",
  "resolution",
  "calm-close",
];

const blockedChoiceTerms = [
  "더 꽉",
  "계속",
  "빼앗",
  "숨어",
  "도망",
  "안 하",
  "혼자만",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertText(
  value: unknown,
  field: string,
  maxLength: number,
  minLength = 1,
) {
  if (
    typeof value !== "string" ||
    value.trim().length < minLength ||
    value.length > maxLength
  )
    throw new Error(
      `${field} must contain ${minLength}-${maxLength} characters`,
    );
}

function assertNotes(value: Record<string, unknown>) {
  ["safetyNotes", "qualityNotes", "revisionNotes"].forEach(field => {
    const notes = value[field];
    if (
      notes !== undefined &&
      (!Array.isArray(notes) ||
        notes.length > 50 ||
        !notes.every(note => typeof note === "string" && note.length <= 500))
    )
      throw new Error(`${field} must be a bounded string array`);
  });
}

function assertPicturebookPages(
  value: unknown,
  expectedLength: number,
  fieldName: string,
) {
  if (!Array.isArray(value) || value.length !== expectedLength) {
    throw new Error(
      `${fieldName} must contain exactly ${expectedLength} pages`,
    );
  }

  value.forEach((page, index) => {
    if (!isRecord(page)) {
      throw new Error(`${fieldName}.${index} must be an object`);
    }

    if ("pageNumber" in page && typeof page.pageNumber !== "number") {
      throw new Error(`${fieldName}.${index}.pageNumber must be a number`);
    }

    assertText(page.textKo, `${fieldName}.${index}.textKo`, 4000, 12);
    assertText(page.imagePrompt, `${fieldName}.${index}.imagePrompt`, 2000);

    if ("emotionalBeat" in page && typeof page.emotionalBeat !== "string") {
      throw new Error(`${fieldName}.${index}.emotionalBeat must be a string`);
    }
  });
}

function parsePicturebookStartResponse(value: string) {
  const parsed = parseJsonObject(value);

  if (!isRecord(parsed)) {
    throw new Error("Invalid picturebook start response: root must be object");
  }

  assertPicturebookPages(parsed.pages, 4, "pages");
  assertText(parsed.title, "title", 200);

  if (!isRecord(parsed.choice)) {
    throw new Error("Invalid picturebook start response: choice is required");
  }
  assertText(parsed.choice.promptKo, "choice.promptKo", 500);

  if (
    !Array.isArray(parsed.choice.options) ||
    parsed.choice.options.length !== 3
  ) {
    throw new Error(
      "Invalid picturebook start response: choice.options must contain exactly 3 options",
    );
  }

  parsed.choice.options.forEach((option, index) => {
    if (!isRecord(option)) {
      throw new Error(`choice.options.${index} must be an object`);
    }

    assertText(option.labelKo, `choice.options.${index}.labelKo`, 80);
    assertText(
      option.resolutionHint,
      `choice.options.${index}.resolutionHint`,
      1000,
    );
  });

  assertNotes(parsed);

  return parsed;
}

function parsePicturebookEndingResponse(value: string) {
  const parsed = parseJsonObject(value);

  if (!isRecord(parsed)) {
    throw new Error("Invalid picturebook ending response: root must be object");
  }

  assertPicturebookPages(parsed.pages, 4, "pages");

  if ("choice" in parsed) {
    throw new Error("Invalid picturebook ending response: choice is forbidden");
  }

  assertNotes(parsed);

  return parsed;
}

function normalizeChoiceOption(
  value: unknown,
  index: number,
): PicturebookChoiceOption {
  const option = isRecord(value) ? value : {};
  const ids: PicturebookChoiceOption["id"][] = ["A", "B", "C"];
  const candidateLabel =
    typeof option?.labelKo === "string" ? option.labelKo.trim() : "";
  const isCandidateLabelUsable = isActionChoiceLabel(candidateLabel);
  // A verb substring list cannot judge whether a Korean action fits this story.
  // Preserve valid model wording; never substitute an unrelated generic choice.
  if (!isCandidateLabelUsable)
    throw new Error(`choice.options.${index}.labelKo is not a usable choice`);
  const labelKo = candidateLabel.replace(/\.$/, "");
  const candidateResolutionHint =
    typeof option?.resolutionHint === "string"
      ? option.resolutionHint.trim()
      : "";

  return {
    id: ids[index],
    labelKo,
    resolutionHint: candidateResolutionHint,
  };
}

function normalizePage(
  value: unknown,
  index: number,
  fallbackText: string,
): PicturebookPage {
  const page = isRecord(value) ? value : {};
  let emotionalBeat = allowedPicturebookBeats.find(
    beat => beat === page.emotionalBeat,
  );
  if (!emotionalBeat) {
    if (index < 2) emotionalBeat = "setup";
    else if (index === 2) emotionalBeat = "choice";
    else emotionalBeat = "resolution";
  }

  return {
    pageNumber:
      typeof page?.pageNumber === "number" ? page.pageNumber : index + 1,
    textKo:
      typeof page?.textKo === "string" && page.textKo.trim()
        ? page.textKo.trim()
        : fallbackText,
    imagePrompt:
      typeof page?.imagePrompt === "string" && page.imagePrompt.trim()
        ? page.imagePrompt.trim()
        : "Warm Korean bedtime picturebook illustration, soft paper texture, gentle child character, cozy room, calm colors",
    emotionalBeat,
  };
}

function createFallbackPicturebookStart(
  input: PicturebookInput,
): PicturebookDraft {
  const childName = input.childName.trim() || "아이";
  const situation = input.situation.trim() || "오늘 마음이 조금 어려웠던 일";
  const lesson = input.lesson.trim() || "마음을 천천히 말해도 괜찮다는 것";
  const favoriteThing = input.interests?.trim() || "작은 별";
  const createdAt = new Date().toISOString();

  return {
    kind: "picturebook",
    status: "choice-ready",
    title: `${childName}의 마음 주머니`,
    childName,
    ageBand: getAgeBand(input.childAge),
    situation,
    lesson,
    tone: input.tone || "calm",
    interests: input.interests?.trim() || "",
    pages: [
      {
        pageNumber: 1,
        textKo: `오늘 ${childName}의 하루에는 작은 매듭이 생겼어요. ${situation} 그 순간, 손끝이 꼼지락거리고 목소리는 이불 속으로 숨어버렸지요.`,
        imagePrompt:
          "Warm Korean picturebook scene of a child after a difficult day, soft evening light, gentle expression, cozy realistic details",
        emotionalBeat: "setup",
      },
      {
        pageNumber: 2,
        textKo: `집에 돌아온 마음은 조용조용 걸었어요. 가슴 안쪽에는 말랑한 구름 하나가 둥실, 아직 녹지 않은 채 떠 있었어요.`,
        imagePrompt:
          "Child sitting quietly in a cozy room with a small soft cloud metaphor near the heart, Korean bedtime picturebook, warm paper texture",
        emotionalBeat: "setup",
      },
      {
        pageNumber: 3,
        textKo: `그때 베개 옆에서 ${favoriteThing}만 한 불빛이 톡 켜졌어요. 불빛은 말없이 반짝이며 ${childName}의 마음 주머니를 살짝 비추었어요.`,
        imagePrompt:
          "Tiny warm light beside a pillow, child noticing a gentle magical object, Korean bedtime picturebook illustration",
        emotionalBeat: "tension",
      },
      {
        pageNumber: 4,
        textKo: `${childName}는 마음 주머니 안에서 세 가지 작은 용기를 보았어요. 어느 것부터 꺼내볼까요?`,
        imagePrompt:
          "Three small glowing tokens inside a soft heart pocket, child choosing gently, cozy dreamlike bedtime room",
        emotionalBeat: "choice",
      },
    ],
    choice: {
      afterPage: 4,
      promptKo: `${childName}는 어떤 작은 용기를 꺼내볼까요?`,
      options: [
        {
          id: "A",
          labelKo: "손바닥에 마음을 올려 보여줘요",
          resolutionHint:
            "주인공이 마음을 물건처럼 상상해 보여주며 첫 말을 꺼냅니다.",
        },
        {
          id: "B",
          labelKo: "엄마 손을 잡고 한 걸음 다가가요",
          resolutionHint:
            "주인공이 혼자 해결하지 않고 부모와 함께 작은 행동을 시도합니다.",
        },
        {
          id: "C",
          labelKo: "작은 불빛에게 귓속말을 해요",
          resolutionHint:
            "주인공이 상상 장치에 마음을 말하며 용기를 천천히 얻습니다.",
        },
      ],
    },
    safetyNotes: ["fallback-generated"],
    qualityNotes: ["fallback follows fixed 8-page bedtime arc"],
    createdAt,
  };
}

function normalizePicturebookStart(
  raw: Record<string, unknown>,
  input: PicturebookInput,
): PicturebookDraft {
  const fallback = createFallbackPicturebookStart(input);
  const rawPages = Array.isArray(raw?.pages) ? raw.pages : [];
  const pages = [0, 1, 2, 3].map(index =>
    normalizePage(rawPages[index], index, fallback.pages[index].textKo),
  );

  const rawChoice = isRecord(raw.choice) ? raw.choice : {};
  const rawOptions = Array.isArray(rawChoice.options) ? rawChoice.options : [];
  const choice: PicturebookChoice = {
    afterPage: 4,
    promptKo:
      typeof rawChoice.promptKo === "string" && rawChoice.promptKo.trim()
        ? rawChoice.promptKo.trim()
        : fallback.choice.promptKo,
    options: [0, 1, 2].map(index =>
      normalizeChoiceOption(rawOptions[index], index),
    ),
  };

  return {
    ...fallback,
    title:
      typeof raw?.title === "string" && raw.title.trim()
        ? raw.title.trim()
        : fallback.title,
    pages: pages.map((page, index) => ({ ...page, pageNumber: index + 1 })),
    choice,
    safetyNotes: getStringArray(raw?.safetyNotes),
    qualityNotes: getStringArray(raw?.qualityNotes),
    revisionNotes: getStringArray(raw?.revisionNotes),
  };
}

function normalizePicturebookEnding(
  raw: Record<string, unknown>,
  draft: PicturebookDraft,
  selectedChoiceId: PicturebookChoiceOption["id"],
): PicturebookDraft {
  const selectedChoice =
    draft.choice.options.find(option => option.id === selectedChoiceId) ||
    draft.choice.options[0];
  const rawPages = Array.isArray(raw?.pages) ? raw.pages : [];
  const fallbackTexts = [
    `${draft.childName}는 ${selectedChoice.labelKo.replace(/요$/, "")} 보았어요. 아주 작게 시작했는데, 마음 주머니가 살짝 가벼워졌어요.`,
    `그런데 구름 한 조각이 다시 꼬물꼬물 올라왔어요. ${draft.childName}는 손끝을 꼭 쥐고 천천히 숨을 내쉬었어요.`,
    `작은 불빛이 방 안을 동그랗게 비추었어요. 굳어 있던 어깨가 조금 내려가고, 마음 매듭도 느슨해졌어요.`,
    `이불이 포근히 올라오자 방은 조용해졌어요. ${draft.childName}는 ${draft.lesson}을 말 대신 작은 숨으로 품고 잠이 들었어요.`,
  ];

  const endingPages = [0, 1, 2, 3].map(index => {
    const page = normalizePage(
      rawPages[index],
      index + 4,
      fallbackTexts[index],
    );
    return {
      ...page,
      pageNumber: index + 5,
      emotionalBeat:
        index === 3 ? ("calm-close" as const) : ("resolution" as const),
    };
  });

  return {
    ...draft,
    status: "complete",
    selectedChoiceId,
    pages: [...draft.pages.slice(0, 4), ...endingPages],
    safetyNotes: Array.from(
      new Set([...draft.safetyNotes, ...getStringArray(raw?.safetyNotes)]),
    ),
    qualityNotes: uniqueStrings([
      ...(draft.qualityNotes || []),
      ...getStringArray(raw?.qualityNotes),
    ]),
    revisionNotes: uniqueStrings([
      ...(draft.revisionNotes || []),
      ...getStringArray(raw?.revisionNotes),
    ]),
    completedAt: new Date().toISOString(),
  };
}

async function rewritePicturebookStartForQuality(
  draft: PicturebookDraft,
  input: PicturebookInput,
) {
  const prompt = `${PICTUREBOOK_SYSTEM_PROMPT}

아래 1차 그림책 초안을 품질 기준에 맞게 리라이트하세요.

검수 기준:
1. 잠자리에서 부모가 소리 내어 읽을 수 있는가?
2. 아이의 실제 상황이 설명이 아니라 장면으로 살아났는가?
3. 교훈이 말로 설명되지 않고 행동과 감각으로 전달되는가?
4. 1-4쪽 고정 구조가 지켜졌는가?
${PICTUREBOOK_START_ARC}
${PICTUREBOOK_STYLE_RULES}
${PICTUREBOOK_CHOICE_RULES}

부모 입력:
- 아이 이름: ${input.childName}
- 아이 나이: ${input.childAge}
- 오늘의 상황: ${input.situation}
- 원하는 교훈/감정: ${input.lesson}
- 톤: ${input.tone}
- 관심사: ${input.interests || "없음"}

1차 초안:
${JSON.stringify(draft, null, 2)}

반드시 같은 JSON shape로 반환하세요.
pages는 정확히 4개, choice.options는 정확히 A/B/C 3개입니다.
choice.options의 labelKo는 모두 다음 장면에서 해볼 작은 행동이어야 하고 "~요"로 끝나야 합니다.
qualityNotes와 revisionNotes에는 내부 검수 메모를 짧게 넣어도 됩니다.`;

  try {
    const response = await invokeStoryModel(prompt);
    const rewritten = normalizePicturebookStart(
      parsePicturebookStartResponse(String(response.content)),
      input,
    );

    return {
      ...rewritten,
      createdAt: draft.createdAt,
      safetyNotes: uniqueStrings([
        ...draft.safetyNotes,
        ...rewritten.safetyNotes,
      ]),
      qualityNotes: uniqueStrings([
        ...(draft.qualityNotes || []),
        ...(rewritten.qualityNotes || []),
        "quality-rewrite-applied",
      ]),
      revisionNotes: uniqueStrings([
        ...(draft.revisionNotes || []),
        ...(rewritten.revisionNotes || []),
      ]),
    };
  } catch {
    return {
      ...draft,
      qualityNotes: uniqueStrings([
        ...(draft.qualityNotes || []),
        "quality-rewrite-fallback-used",
      ]),
    };
  }
}

async function rewritePicturebookEndingForQuality(
  completedDraft: PicturebookDraft,
  baseDraft: PicturebookDraft,
  selectedChoiceId: PicturebookChoiceOption["id"],
) {
  const selectedChoice =
    baseDraft.choice.options.find(option => option.id === selectedChoiceId) ||
    baseDraft.choice.options[0];
  const prompt = `${PICTUREBOOK_SYSTEM_PROMPT}

아래 완성 그림책의 5-8쪽 결말 초안을 품질 기준에 맞게 리라이트하세요.

검수 기준:
1. 선택한 행동이 실제 장면으로 이어지는가?
2. 6쪽에 작은 망설임이 있고, 7쪽에 감정이 풀리는 장면이 있는가?
3. 8쪽이 잠자리에서 닫히는 따뜻한 결말인가?
4. 교훈을 직접 설명하지 않고 장면으로 전달하는가?
${PICTUREBOOK_ENDING_ARC}
${PICTUREBOOK_STYLE_RULES}

기존 1-4쪽:
${JSON.stringify(baseDraft.pages.slice(0, 4), null, 2)}

선택된 행동:
${selectedChoice.id}. ${selectedChoice.labelKo}
해결 방향: ${selectedChoice.resolutionHint}

결말 초안:
${JSON.stringify(completedDraft.pages.slice(4), null, 2)}

반드시 JSON만 반환하세요.
pages는 pageNumber 5, 6, 7, 8의 정확히 4개입니다.
새 choice는 절대 만들지 않습니다.
qualityNotes와 revisionNotes에는 내부 검수 메모를 짧게 넣어도 됩니다.`;

  try {
    const response = await invokeStoryModel(prompt);
    const rewritten = normalizePicturebookEnding(
      parsePicturebookEndingResponse(String(response.content)),
      baseDraft,
      selectedChoiceId,
    );

    return {
      ...rewritten,
      createdAt: completedDraft.createdAt,
      completedAt: completedDraft.completedAt,
      safetyNotes: uniqueStrings([
        ...completedDraft.safetyNotes,
        ...rewritten.safetyNotes,
      ]),
      qualityNotes: uniqueStrings([
        ...(completedDraft.qualityNotes || []),
        ...(rewritten.qualityNotes || []),
        "ending-quality-rewrite-applied",
      ]),
      revisionNotes: uniqueStrings([
        ...(completedDraft.revisionNotes || []),
        ...(rewritten.revisionNotes || []),
      ]),
    };
  } catch {
    return {
      ...completedDraft,
      qualityNotes: uniqueStrings([
        ...(completedDraft.qualityNotes || []),
        "ending-quality-rewrite-fallback-used",
      ]),
    };
  }
}

export async function generatePicturebookStart(
  rawInput: PicturebookInput,
  accessToken: string,
): Promise<PicturebookDraft> {
  await requireServerUser(accessToken);
  const invalid = validatePicturebookInput(rawInput);
  if (invalid) throw new Error(invalid);
  const input: PicturebookInput = {
    ...rawInput,
    childName: rawInput.childName.trim(),
    situation: rawInput.situation.trim(),
    lesson: rawInput.lesson.trim(),
    interests: rawInput.interests?.trim(),
  };
  const prompt = `${PICTUREBOOK_SYSTEM_PROMPT}

부모 입력:
- 아이 이름: ${input.childName}
- 아이 나이: ${input.childAge}
- 오늘의 상황: ${input.situation}
- 원하는 교훈/감정: ${input.lesson}
- 톤: ${input.tone}
- 관심사: ${input.interests || "없음"}

고정 서사 구조:
${PICTUREBOOK_START_ARC}
${PICTUREBOOK_STYLE_RULES}
${PICTUREBOOK_CHOICE_RULES}

pages는 정확히 4개만 만드세요. pageNumber는 1, 2, 3, 4입니다.
4쪽 이후에만 choice를 제공합니다. choice.options는 정확히 A/B/C 3개입니다.
각 페이지 textKo는 2-3문장, 잠자리에서 읽기 좋은 한국어로 씁니다.
emotionalBeat는 반드시 setup, tension, choice, resolution, calm-close 중 하나입니다.
선택지 labelKo는 모두 다음 장면에서 아이가 해볼 작은 행동이어야 하고 "~요"로 끝나야 합니다.
imagePrompt는 영어로 씁니다.

반환 JSON shape:
{
  "title": "string",
  "pages": [
    {"pageNumber": 1, "textKo": "string", "imagePrompt": "English prompt", "emotionalBeat": "setup"}
  ],
  "choice": {
    "afterPage": 4,
    "promptKo": "string",
    "options": [
      {"id": "A", "labelKo": "string", "resolutionHint": "string"}
    ]
  },
  "safetyNotes": [],
  "qualityNotes": [],
  "revisionNotes": []
}`;

  try {
    const response = await invokeStoryModel(prompt);
    const draft = normalizePicturebookStart(
      parsePicturebookStartResponse(String(response.content)),
      input,
    );
    return await rewritePicturebookStartForQuality(draft, input);
  } catch (error) {
    throw generationError(
      error,
      "이야기를 만들지 못했어요. 잠시 후 다시 시도해주세요.",
    );
  }
}

export async function generatePicturebookEnding(
  draft: PicturebookDraft,
  selectedChoiceId: PicturebookChoiceOption["id"],
  accessToken: string,
): Promise<PicturebookDraft> {
  await requireServerUser(accessToken);
  if (
    !parsePicturebookDraft(JSON.stringify(draft)) ||
    !["A", "B", "C"].includes(selectedChoiceId)
  )
    throw new Error("그림책 선택지를 확인해주세요.");
  const selectedChoice =
    draft.choice.options.find(option => option.id === selectedChoiceId) ||
    draft.choice.options[0];
  const prompt = `${PICTUREBOOK_SYSTEM_PROMPT}

이미 생성된 그림책:
${JSON.stringify(draft, null, 2)}

선택된 선택지:
${selectedChoice.id}. ${selectedChoice.labelKo}
해결 방향: ${selectedChoice.resolutionHint}

고정 서사 구조:
${PICTUREBOOK_ENDING_ARC}
${PICTUREBOOK_STYLE_RULES}

pages는 정확히 4개만 만드세요. pageNumber는 5, 6, 7, 8입니다.
새 choice를 절대 만들지 마세요.
8쪽은 반드시 차분한 잠자리 결말이어야 합니다.
각 페이지 textKo는 2-3문장, 잠자리에서 읽기 좋은 한국어로 씁니다.
emotionalBeat는 반드시 setup, tension, choice, resolution, calm-close 중 하나입니다.
imagePrompt는 영어로 씁니다.

반환 JSON shape:
{
  "pages": [
    {"pageNumber": 5, "textKo": "string", "imagePrompt": "English prompt", "emotionalBeat": "resolution"}
  ],
  "safetyNotes": [],
  "qualityNotes": [],
  "revisionNotes": []
}`;

  try {
    const response = await invokeStoryModel(prompt);
    const completedDraft = normalizePicturebookEnding(
      parsePicturebookEndingResponse(String(response.content)),
      draft,
      selectedChoiceId,
    );
    return await rewritePicturebookEndingForQuality(
      completedDraft,
      draft,
      selectedChoiceId,
    );
  } catch (error) {
    throw generationError(
      error,
      "결말을 만들지 못했어요. 잠시 후 다시 시도해주세요.",
    );
  }
}

type GeneratedImageResponse = {
  data: Array<{
    b64_json?: string;
  }>;
};

function toSerializableImageResponse(response: {
  data?: Array<{ b64_json?: string | null }>;
}): GeneratedImageResponse {
  return {
    data:
      response.data?.map(image => ({
        b64_json: image.b64_json ?? undefined,
      })) ?? [],
  };
}

export async function generatePicturebookPageImage(
  input: {
    title: string;
    childName: string;
    pageNumber: number;
    textKo: string;
    imagePrompt: string;
  },
  accessToken: string,
): Promise<GeneratedImageResponse> {
  await requireServerUser(accessToken);
  if (!isRecord(input)) throw new Error("그림 요청을 확인해주세요.");
  const { title, childName, pageNumber, textKo, imagePrompt } = input;
  if (
    ![title, childName, textKo, imagePrompt].every(
      value =>
        typeof value === "string" && !!value.trim() && value.length <= 4000,
    ) ||
    !Number.isInteger(pageNumber) ||
    pageNumber < 1 ||
    pageNumber > 8
  )
    throw new Error("그림 요청을 확인해주세요.");
  if (!OPEN_AI_API_KEY)
    throw new GenerationError(
      "그림 생성 서비스에 연결할 수 없어요. 운영팀에 문의해주세요.",
      false,
    );
  const prompt = `Children's bedtime picturebook illustration for ages 3-7.
Book title: ${title}. Child protagonist: ${childName}. Page: ${pageNumber}.
Korean scene: ${textKo}. Scene prompt: ${imagePrompt}.
Warm gouache and colored pencil texture, cozy light, child-safe composition.
No text, captions, speech bubbles, or letters. Consistent main child character, square illustration.`;
  try {
    const response = await openaiClient.images.generate({
      prompt: prompt.slice(0, 4000),
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare",
      n: 1,
      quality: "low",
      output_format: "png",
      size: "1024x1024",
    });
    return toSerializableImageResponse(response);
  } catch (error) {
    throw generationError(
      error,
      "그림을 만들지 못했어요. 잠시 후 다시 시도해주세요.",
    );
  }
}

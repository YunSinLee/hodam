import type {
  PicturebookAdventure,
  PicturebookDraft,
  PicturebookInput,
} from "@/app/types/openai";

export const adventureWorlds = {
  "moon-bakery": {
    label: "달나라 빵집",
    symbol: "☾",
    invitation: "사라진 별사탕을 찾아요",
    situation:
      "단짝과 달나라 빵집에 갔는데, 갓 구운 빵 위에 올릴 별사탕이 사라졌어요. 빵집 안에 남은 작은 단서를 따라 찾아보려 해요.",
  },
  "dinosaur-post": {
    label: "공룡 우체국",
    symbol: "✉",
    invitation: "주인 없는 편지를 배달해요",
    situation:
      "단짝과 공룡 마을 우체국에서 받는 이름이 빗물에 지워진 편지를 발견했어요. 봉투의 작은 그림을 단서로 주인을 찾아 배달하려 해요.",
  },
  "ocean-library": {
    label: "바닷속 도서관",
    symbol: "≋",
    invitation: "웃음소리를 잃어버린 책을 만나요",
    situation:
      "단짝과 물속에서도 편하게 숨 쉬는 상상의 바닷속 도서관에 갔어요. 웃음소리를 들려주던 조개책이 조용해져서, 책 사이의 단서를 따라 소리를 찾아보려 해요.",
  },
} as const;

export const adventureCompanions = {
  rabbit: {
    label: "토끼",
    name: "두부",
    personality: "귀를 쫑긋, 작은 소리도 잘 들어요",
    appearance:
      "a small cream-white rabbit with long ears and a mustard-yellow scarf",
  },
  fox: {
    label: "여우",
    name: "모모",
    personality: "킁킁, 새로운 단서를 찾기 좋아해요",
    appearance:
      "a small russet-orange fox with a white tail tip and a teal shoulder satchel",
  },
  dinosaur: {
    label: "꼬마 공룡",
    name: "콩이",
    personality: "느긋한 걸음으로 친구를 기다려줘요",
    appearance:
      "a small sage-green round dinosaur with three cream back plates and a coral neckerchief",
  },
} as const;

export const heroStyles = {
  short: { label: "짧은 머리", appearance: "short dark-brown hair" },
  bob: { label: "단발머리", appearance: "chin-length dark-brown bobbed hair" },
  curly: { label: "곱슬머리", appearance: "short curly dark-brown hair" },
} as const;

export const defaultAdventure: PicturebookAdventure = {
  world: "moon-bakery",
  companion: "rabbit",
  companionName: "두부",
  heroStyle: "short",
};

export function parseAdventure(value: unknown): PicturebookAdventure | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as PicturebookAdventure;
  if (
    typeof data.world !== "string" ||
    typeof data.companion !== "string" ||
    typeof data.heroStyle !== "string" ||
    !Object.hasOwn(adventureWorlds, data.world) ||
    !Object.hasOwn(adventureCompanions, data.companion) ||
    !Object.hasOwn(heroStyles, data.heroStyle) ||
    typeof data.companionName !== "string" ||
    !data.companionName.trim() ||
    data.companionName.length > 20 ||
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u001f\u007f]/.test(data.companionName)
  )
    return null;
  return {
    world: data.world,
    companion: data.companion,
    companionName: data.companionName.trim(),
    heroStyle: data.heroStyle,
  };
}

export function adventureCast(adventure: PicturebookAdventure) {
  return `Child protagonist: ${heroStyles[adventure.heroStyle].appearance}, sage-green overalls over a cream long-sleeve shirt, ochre shoes. Companion: ${adventureCompanions[adventure.companion].appearance}. Keep these character designs across every adventure; bedtime clothing may change to cream pajamas.`;
}

export function nextAdventureInput(
  book: PicturebookDraft,
): PicturebookInput | null {
  const adventure = parseAdventure(book.adventure);
  if (
    book.status !== "complete" ||
    !adventure ||
    !/^(?:[3-9]|1[0-2])$/.test(book.childAge || "")
  )
    return null;
  const worlds = Object.keys(
    adventureWorlds,
  ) as PicturebookAdventure["world"][];
  return {
    childName: book.childName,
    childAge: book.childAge!,
    tone: book.tone,
    situation: "",
    lesson: "",
    interests: book.interests || "",
    adventure: {
      ...adventure,
      world: worlds[(worlds.indexOf(adventure.world) + 1) % worlds.length],
    },
  };
}

// A short-lived, owner-scoped handoff. Never put a child's name in a URL.
let starter: {
  owner: string;
  input: PicturebookInput;
  expiresAt: number;
} | null = null;
export function prepareAdventureStarter(book: PicturebookDraft, owner: string) {
  const input = nextAdventureInput(book);
  starter =
    owner && input
      ? { owner, input, expiresAt: Date.now() + 15 * 60 * 1000 }
      : null;
  return !!starter;
}
export function consumeAdventureStarter(owner: string | undefined) {
  const current = starter;
  starter = null;
  return current && current.owner === owner && Date.now() < current.expiresAt
    ? current.input
    : null;
}

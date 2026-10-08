// Synthetic only. Three age bands × two modes × four situations.
const daily = [
  {
    slug: "night",
    situation: "불을 끄면 무섭다며 혼자 잠들기 어려워해요.",
    lesson: "천천히 안심하는 마음",
    interests: "토끼 인형, 작은 별",
  },
  {
    slug: "sharing",
    situation:
      "놀이터에서 친구가 빨간 삽을 쓰고 싶어 하자 꼭 쥐고 놓지 않았어요.",
    lesson: "내 차례와 친구 차례를 함께 정해보기",
    interests: "오리, 모래놀이",
  },
  {
    slug: "new-friend",
    situation:
      "새로 만난 친구에게 함께 블록을 쌓자고 말하고 싶었지만 입이 떨어지지 않았어요.",
    lesson: "긴장해도 작은 말로 마음을 전해보기",
    interests: "기차, 블록",
  },
  {
    slug: "mistake",
    situation:
      "동생에게 보여주려던 종이배가 찢어져서 속상했어요. 동생은 옆에서 종이배를 기다리고 있어요.",
    lesson: "속상한 마음을 말하고 함께 다시 시도하기",
    interests: "종이배, 물웅덩이",
  },
];
const worlds = [
  "moon-bakery",
  "dinosaur-post",
  "ocean-library",
  "dinosaur-post",
];
const companions = ["rabbit", "fox", "dinosaur", "rabbit"];
const companionNames = ["두부", "모모", "콩이", "달콩"];
const ages = [3, 6, 10];
const names = ["별이", "하루", "도윤", "수아"];
const tones = ["calm", "playful", "brave"];

export const comparisonCases = ages.flatMap((age, band) =>
  ["daily", "adventure"].flatMap(mode =>
    daily.map((scenario, index) => ({
      id: `age-${age}-${mode}-${scenario.slug}`,
      ageBand: ["3-4", "5-7", "8+"][band],
      mode,
      choice: ["A", "B", "C"][(band + index) % 3],
      input: {
        childName: names[index],
        childAge: String(age),
        tone: tones[(band + index) % 3],
        situation: mode === "daily" ? scenario.situation : "",
        lesson: mode === "daily" ? scenario.lesson : "",
        interests:
          mode === "daily"
            ? scenario.interests
            : "반짝이는 단서, 단짝과 이야기하기",
        ...(mode === "adventure"
          ? {
              adventure: {
                world: worlds[index],
                companion: companions[index],
                companionName: companionNames[index],
                heroStyle: ["short", "bob", "curly"][(band + index) % 3],
              },
            }
          : {}),
      },
    })),
  ),
);

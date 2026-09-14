export type PublicStory = {
  slug: "moonlit-rabbit" | "pinecone-promise" | "little-fox-crossing";
  title: string;
  description: string;
  ageLabel: string;
  theme: string;
  readingMinutes: number;
  pages: { text: string }[];
  image: { src: string; alt: string };
  imagePrompt: string;
};

export const PUBLIC_STORIES: PublicStory[] = [
  {
    slug: "moonlit-rabbit",
    title: "토끼의 작은 등불",
    description:
      "불을 낮추니 익숙한 방이 조금 달라 보여요. 작은 토끼가 등불 곁에서 장난감 새와 편안히 밤을 맞는 이야기예요.",
    ageLabel: "5~7세",
    theme: "어둠이 조금 낯선 밤",
    readingMinutes: 3,
    pages: [
      {
        text: "토끼는 잠옷 단추를 잠그고 침대에 올라갔어요. 할머니가 큰 불을 끄자 파란 커튼이 짙은 남색으로 바뀌었어요. 늘 보던 방인데 조금 낯설었어요. 토끼는 작은 등불을 꼭 끌어당겼어요.",
      },
      {
        text: "그때 벽에 커다란 새 모양이 나타났어요. 토끼가 등불을 움직이자 새도 기다란 날개를 흔들었어요. 토끼는 발끝을 이불 속에 넣었어요. “할머니, 우리 방에 큰 새가 생겼어요.”",
      },
      {
        text: "할머니가 침대 곁에 앉았어요. 토끼는 새를 가리키려다 등불 옆의 작은 나무 장난감을 보았어요. 낮에 가지고 놀던 새였어요. 토끼가 장난감의 날개를 만지자 벽의 날개도 함께 흔들렸어요.",
      },
      {
        text: "“이 작은 새가 저만큼 커졌네.” 토끼는 장난감 새를 등불에서 조금 멀리 밀었어요. 벽의 새가 작아졌어요. 날개도 짧아져 책장 옆에 조그맣게 머물렀어요. 토끼의 발끝이 이불 밖으로 나왔어요.",
      },
      {
        text: "토끼는 등불도 책장 쪽으로 옮겨 보았어요. 이번에는 침대가 어두워져 그림책이 잘 보이지 않았어요. “책은 보고 싶은데.” 토끼는 빈 나무 상자를 침대 곁으로 끌어와 그 위에 등불을 놓았어요.",
      },
      {
        text: "책 위로 둥그런 빛이 내려앉았어요. 장난감 새는 책장 가운데 칸에 올려놓았어요. 그곳에서는 작은 부리와 짧은 날개가 그대로 보였어요. 토끼는 새를 반듯하게 세웠어요. “너도 거기서 쉬어.”",
      },
      {
        text: "할머니가 그림책을 펼쳤어요. 토끼는 이불을 배까지 덮고 그림 속 달팽이를 찾았어요. 한 장, 또 한 장. 책장을 넘기는 소리에 귀가 천천히 기울었어요. 마지막 장에서는 하품이 먼저 나왔어요.",
      },
      {
        text: "할머니가 책을 덮고 토끼의 이불을 펴 주었어요. 작은 등불은 나무 상자 위에 그대로 있었어요. 토끼는 책장에 앉은 새를 한 번 보고 눈을 감았어요. 파란 커튼 아래로 밤바람이 살며시 들어왔어요.",
      },
    ],
    image: {
      src: "/stories/moonlit-rabbit.webp",
      alt: "파란 커튼이 있는 침실에서 작은 토끼와 할머니 토끼가 등불 아래 그림책을 읽고, 책장에는 나무 새가 앉아 있어요.",
    },
    imagePrompt:
      "An original children's picturebook illustration, a single complete landscape scene in a 3:2 aspect ratio. A small cream-colored rabbit in pale sage pajamas nestles under an ivory quilt in a cozy modest woodland bedroom. A gentle older cream rabbit sits beside the bed reading an open picturebook whose pages contain tiny abstract pictures but absolutely no lettering. A small enclosed amber bedside lantern stands steadily on a low wooden box beside the bed. A tiny carved wooden bird sits on the middle shelf of a bookcase, away from the lantern. Deep blue curtains frame a quiet moonlit window. The rabbit looks drowsy and comfortable. The lantern is visibly lit, casting only small soft shadows; no looming or frightening silhouettes. Warm hand-painted watercolor, soft colored-pencil details, visible natural ivory paper grain, muted sage, warm ochre, dusty blue, and cream palette, simple rounded animal characters with expressive gentle faces, restrained detail and generous breathing room. Eye-level intimate composition, warm lamplight balanced with cool nighttime window light. No collage, no panels, no border, no title, no captions, no typography, no letters, no logos, no watermark, no user interface. This is a fictional animal family, not a photograph.",
  },
  {
    slug: "pinecone-promise",
    title: "솔방울 꽃 옆의 작은 길",
    description:
      "곰이 모아 둔 솔방울을 다람쥐가 옮겼어요. 서로 다르게 생각했던 두 친구가 나란히 앉아 새로운 모양을 만들어요.",
    ageLabel: "5~7세",
    theme: "친구와 마음 나누기",
    readingMinutes: 3,
    pages: [
      {
        text: "곰은 참나무 아래에서 솔방울 여섯 개를 주웠어요. 통통한 것, 길쭉한 것, 끝이 구부러진 것도 있었어요. 곰은 그중 가장 동그란 솔방울을 가운데 놓고, 나머지를 빙 둘러 작은 꽃을 만들었어요.",
      },
      {
        text: "마지막 솔방울이 자꾸 굴러갔어요. 곰은 받칠 만한 나뭇잎을 찾으러 풀밭으로 갔어요. 그사이 다람쥐가 왔어요. “솔방울이 많네!” 다람쥐는 하나씩 집어 자기 발 앞에 길게 늘어놓았어요.",
      },
      {
        text: "곰이 돌아왔을 때 꽃은 사라지고 솔방울 길이 생겨 있었어요. “그거…….” 곰은 나뭇잎만 만지작거렸어요. 다람쥐는 끝이 구부러진 솔방울을 가리켰어요. “여기가 길의 끝이야. 같이 걸어 볼래?”",
      },
      {
        text: "곰은 고개를 저었어요. 다람쥐의 꼬리가 천천히 내려갔어요. 곰은 손에 쥔 나뭇잎을 펴며 말했어요. “나는 꽃을 만들고 있었어. 네가 볼 때까지 남겨 두고 싶었는데.” 다람쥐가 솔방울을 내려다보았어요.",
      },
      {
        text: "“네가 만든 건지 몰랐어. 옮겨서 미안해.” 다람쥐가 가운데 솔방울을 집었어요. “어떻게 놓았는지 보여 줄래?” 곰은 동그란 솔방울부터 놓았어요. 이번에는 밑에 나뭇잎을 받쳐 주었어요.",
      },
      {
        text: "다람쥐가 곰이 가리키는 자리에 솔방울을 놓았어요. 작은 꽃이 다시 피었어요. 곰은 꽃 옆의 빈 땅을 보았어요. “네 길도 여기 있으면 좋겠다.” 다람쥐는 주위를 둘러보더니 떨어진 잔가지를 모아 왔어요.",
      },
      {
        text: "잔가지 길이 솔방울 꽃 옆으로 구불구불 이어졌어요. 곰이 굵은 가지를 놓으면 다람쥐가 작은 가지를 이었어요. 길 끝에는 넓은 나뭇잎 두 장을 나란히 깔았어요. 두 친구가 엉덩이를 붙이고 앉았어요.",
      },
      {
        text: "해가 낮아지자 솔방울 그림자도 조금씩 길어졌어요. 다람쥐는 꼬리를 무릎에 얹었어요. 곰은 등에 닿은 나무의 온기를 느꼈어요. 둘은 말없이 꽃과 길을 바라보았어요. 마른 잎 하나가 길 끝에 내려앉았어요.",
      },
    ],
    image: {
      src: "/stories/pinecone-promise.webp",
      alt: "참나무 아래 곰과 다람쥐가 나란히 앉아, 솔방울 여섯 개로 만든 꽃과 작은 나뭇가지 길을 바라봐요.",
    },
    imagePrompt:
      "An original children's picturebook illustration, a single complete landscape scene in a 3:2 aspect ratio. A small warm-brown bear and a small gray squirrel sit quietly shoulder to shoulder on two broad fallen leaves beneath an old oak tree. They look with quiet satisfaction at a small flower arrangement made of exactly six pinecones, one round pinecone in the center surrounded by five pinecones; a winding miniature path made of short fallen twigs runs beside the pinecone flower toward the friends. One dry leaf rests at the end of the twig path. The squirrel's fluffy tail rests over its lap. Keep both animals small and gently expressive, with natural fur and no human clothing. Late afternoon in a calm woodland clearing, long soft shadows, low warm sunlight, muted autumn green and ochre leaves. Warm hand-painted watercolor, soft colored-pencil details, visible natural ivory paper grain, muted sage, warm ochre, dusty blue, and cream palette, simple rounded animal characters, restrained detail and generous breathing room. Intimate low eye-level composition showing the friends and their pinecone creation together. No magical effects, no collage, no panels, no border, no title, no captions, no typography, no letters, no logos, no watermark, no user interface. Fictional woodland animals, not a photograph.",
  },
  {
    slug: "little-fox-crossing",
    title: "여우의 작은 다리",
    description:
      "아빠와 산책하던 작은 여우가 처음 보는 나무다리 앞에 멈췄어요. 서두르지 않고 자기 걸음으로 시냇물을 건너는 이야기예요.",
    ageLabel: "5~7세",
    theme: "처음 해보는 일의 작은 용기",
    readingMinutes: 3,
    pages: [
      {
        text: "여우는 아빠와 저녁 산책을 나왔어요. 익숙한 갈림길에서 오늘은 오른쪽으로 갔어요. 조금 걷자 졸졸 물소리가 들렸어요. 작은 시냇물 위에 난간이 달린 나무다리가 놓여 있었어요.",
      },
      {
        text: "다리 건너에는 하얀 꽃이 피어 있었어요. 여우가 한 발을 내밀다가 멈췄어요. 나무판 사이로 반짝이는 물이 보였거든요. “발밑에서 자꾸 움직여요.” 여우는 두 발을 풀밭으로 모았어요.",
      },
      {
        text: "아빠는 여우 곁에 쪼그려 앉았어요. 둘은 한동안 흐르는 물을 보았어요. 작은 잎이 둥둥 떠와 다리 밑으로 지나갔어요. “나는 조금 있다 갈래요.” 여우가 말했어요. 아빠는 고개를 끄덕였어요.",
      },
      {
        text: "여우는 난간을 잡고 첫 나무판에 한 발만 올려 보았어요. 단단한 판이 발바닥에 닿았어요. 아빠가 바로 옆에 섰어요. 여우는 남은 발도 올렸어요. 아직 풀밭이 꼬리에 닿을 만큼 가까웠어요.",
      },
      {
        text: "“다음 판까지만 가 볼게요.” 여우는 난간을 따라 손을 조금 옮겼어요. 한 발, 다른 한 발. 아빠도 나란히 걸었어요. 세 번째 판에서는 물소리가 커져 멈췄어요. 여우가 아빠의 손을 잡았어요.",
      },
      {
        text: "아빠의 손은 따뜻했어요. 여우는 다리 끝의 하얀 꽃을 보았어요. 꽃 한 송이가 바람에 까딱였어요. 여우는 꽃을 보며 다음 판으로 옮겨 갔어요. 발을 크게 벌리지 않아도 조금씩 가까워졌어요.",
      },
      {
        text: "마지막 나무판에서 내려오자 폭신한 흙이 밟혔어요. 여우는 하얀 꽃 옆에 앉았어요. “생각보다 꽃이 작네요.” 아빠도 몸을 낮춰 꽃을 보았어요. 여우는 다리를 돌아보고 발에 묻은 흙을 톡톡 털었어요.",
      },
      {
        text: "집으로 돌아갈 때도 아빠와 손을 잡고 천천히 건넜어요. 잠자리에 누운 여우는 발가락을 한 번 꼼지락거렸어요. 창밖에서 바람이 풀잎을 스쳤어요. 여우의 꼬리가 이불 아래 둥글게 말렸어요.",
      },
    ],
    image: {
      src: "/stories/little-fox-crossing.webp",
      alt: "작은 여우가 아빠 여우의 손을 잡고 난간이 있는 나무다리를 천천히 건너요. 잔잔한 시냇물 건너편에는 하얀 꽃이 피어 있어요.",
    },
    imagePrompt:
      "An original children's picturebook illustration, a single complete landscape scene in a 3:2 aspect ratio. A small russet fox with cream cheeks carefully crosses a short, sturdy wooden footbridge beside its larger father fox. The father gently holds the child's inside paw; the child rests its other paw on the near wooden handrail. Both foxes stand fully on the broad, level wooden deck. The bridge has solid child-height wooden handrails on both sides and low protective rails; no broken boards, no jumping, no slippery stepping stones. A very shallow calm narrow stream flows below, with a few soft ripples and one floating leaf. Small white flowers grow at the far end of the bridge. The little fox looks quietly attentive and curious, and the father walks patiently at the same small pace. Natural fur, no clothing. Warm early-evening woodland light. Warm hand-painted watercolor, soft colored-pencil details, visible natural ivory paper grain, muted sage, warm ochre, dusty blue, and cream palette, simple rounded animal characters with gentle expressions, restrained detail and generous breathing room. A side three-quarter view that clearly shows the safe bridge deck, both foxes, the stream, and the flower bank. No dramatic peril, no magical effects, no collage, no panels, no border, no title, no captions, no typography, no letters, no logos, no watermark, no user interface. Fictional woodland animals, not a photograph.",
  },
];

export function getPublicStory(slug: string): PublicStory | undefined {
  return PUBLIC_STORIES.find(story => story.slug === slug);
}

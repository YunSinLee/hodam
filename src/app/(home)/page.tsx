"use client";

import Link from "next/link";
import { extractStoryContentFromHTML } from "@/services/actions/openai";

export default function Home() {
  async function test() {
    const html = `<ul class="messages">
    <li class="korean">옛날 옛적, 깊은 산속 작은 마을에 윤신이라는 호기심 많은 소년이 살고 있었어요.</li>
    <li class="english">Once upon a time, in a small village deep in the forest, there lived a curious boy named Yunshin.</li>
    <li class="korean">윤신은 자주 숲속을 탐험하곤 했는데, 어느 날 숲 가장 깊은 곳에서 커다란 호랑이를 만났어요.</li>
    <li class="english">Yunshin often explored the forest, and one day, he met a large tiger in the deepest part of the forest.</li>
    <li class="korean">호랑이는 윤신에게 깊은 숲 속에 숨겨진 보물 구슬이 있다고 말해주었어요.</li>
    <li class="english">The tiger told Yunshin about a treasure bead hidden deep in the forest.</li>
    <li class="korean">하지만 이 구슬은 찾는 자에게 큰 힘을 주지만, 반드시 마음이 순수해야만 진정한 힘을 발휘할 수 있었어요.</li>
    <li class="english">However, while this bead could grant great power to its finder, one had to have a pure heart to truly harness its power.</li>
    </ul>
    
    <p class="notice">윤신은 호랑이의 말을 듣고 어떻게 할까요?</p>
    
    <ol class="selections">
    <li class="korean">구슬을 찾기 위해 호랑이와 함께 숲으로 떠난다.</li>
    <li class="english">Yunshin decides to venture into the forest with the tiger to find the bead.</li>
    <li class="korean">구슬에 대한 이야기가 신기하긴 하지만, 위험할 수도 있으니 마을로 돌아간다.</li>
    <li class="english">Though intrigued by the story of the bead, he considers it might be dangerous and decides to return to the village.</li>
    <li class="korean">먼저 다른 마을 사람들과 상의하여 함께 찾으러 갈지 결정한다.</li>
    <li class="english">He decides to consult with other villagers first to determine whether to search for it together.</li>
    </ol>
    
    <p class="image">A colorful illustration of a curious boy named Yunshin, staring in wonder at a majestic tiger, both standing in a lush, vibrant forest. The tiger seems friendly and is speaking to Yunshin, with a hint of a mystical glowing bead visible in the background, partially hidden behind ancient trees.</p>`;

    const data = await extractStoryContentFromHTML(html);
    console.log("data", data);
  }
  return (
    <div className="flex flex-col items-center gap-4 mt-20">
      <h1 className="text-xl">호담을 시작할까요?</h1>
      <button onClick={() => test()}>시작</button>
      <Link href="./service">
        <button className="text-xl px-4 py-2 bg-orange-500 hover:bg-orange-700 text-white bturn bturn-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 shadow">
          이야기 만들어보기
        </button>
      </Link>
    </div>
  );
}

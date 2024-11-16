export function useHodamSpeech() {
  const HodamSpeech = new SpeechSynthesisUtterance();

  async function changeHodamSpeechSetting({
    lang,
    volume,
    rate,
    pitch,
  }: {
    lang?: string;
    volume?: number;
    rate?: number;
    pitch?: number;
  }) {
    if (lang) HodamSpeech.lang = lang;
    if (volume) HodamSpeech.volume = volume;
    if (rate) HodamSpeech.rate = rate;
    if (pitch) HodamSpeech.pitch = pitch;
  }

  changeHodamSpeechSetting({
    lang: "ko-KR",
    volume: 1,
    rate: 0.8,
    pitch: 0.75,
  });

  function setText(text: string) {
    HodamSpeech.text = text;
  }

  function speak() {
    window.speechSynthesis.speak(HodamSpeech);
  }

  function stop() {
    window.speechSynthesis.cancel();
  }

  return { HodamSpeech, changeHodamSpeechSetting, setText, speak, stop };
}

// 톤앤매너에 따른 스타일 프롬프트 매핑
const STYLE_PROMPTS = {
  전문적: '전문 치료사처럼 차분하고 신뢰감 있는 목소리로 또렷하게 읽어주세요.',
  따뜻한: '따뜻하고 친근한 목소리로, 육아에 지친 부모님께 말하듯 천천히 읽어주세요.',
  교육적: '선생님처럼 명확하고 이해하기 쉽게, 핵심을 강조하며 읽어주세요.',
};

export const TONE_OPTIONS = Object.keys(STYLE_PROMPTS);

// Gemini TTS 음성 목록
export const VOICE_OPTIONS = [
  { id: 'Kore', label: 'Kore (여성, 차분)', gender: '여성' },
  { id: 'Aoede', label: 'Aoede (여성, 밝은)', gender: '여성' },
  { id: 'Leda', label: 'Leda (여성, 부드러운)', gender: '여성' },
  { id: 'Zephyr', label: 'Zephyr (여성, 경쾌한)', gender: '여성' },
  { id: 'Charon', label: 'Charon (남성, 깊은)', gender: '남성' },
  { id: 'Fenrir', label: 'Fenrir (남성, 힘있는)', gender: '남성' },
  { id: 'Puck', label: 'Puck (남성, 친근한)', gender: '남성' },
  { id: 'Orus', label: 'Orus (남성, 안정적)', gender: '남성' },
];

const DELAY_BETWEEN_CALLS = 800;

export const DEFAULT_SPEED_RATE = 1.5;

export async function synthesizeSpeech(text, tone = '따뜻한', speedRate = DEFAULT_SPEED_RATE, voiceName = 'Kore') {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voiceName,
      stylePrompt: STYLE_PROMPTS[tone] || STYLE_PROMPTS['따뜻한'],
      speedRate
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`TTS API 오류 (${res.status}): ${err.substring(0, 200)}`);
  }

  const data = await res.json();
  return data.audioContent; // base64 WAV
}

export async function getAudioDuration(base64Audio) {
  const binary = atob(base64Audio);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer);
    return audioBuffer.duration;
  } finally {
    audioCtx.close();
  }
}

export async function synthesizeAllSections(script, { tone = '따뜻한', speedRate = DEFAULT_SPEED_RATE, voiceName = 'Kore', onProgress, cachedAudios = [] } = {}) {
  const items = [];

  const textParts = [];
  const introText = script.hook
    ? script.hook + (script.bridge ? ' ' + script.bridge : '')
    : '';
  if (introText) {
    textParts.push({ id: 'intro', text: introText });
  }
  if (script.sections) {
    script.sections.forEach((sec, idx) => {
      // Skip section if it duplicates the intro (hook + bridge)
      const secText = (sec.script || '').replace(/\s+/g, '');
      const introNorm = introText.replace(/\s+/g, '');
      if (introNorm && (secText === introNorm || introNorm.includes(secText) || secText.includes(introNorm))) {
        return;
      }
      textParts.push({ id: `section_${idx}`, text: sec.script });
    });
  }
  if (script.cta?.text) {
    textParts.push({ id: 'outro', text: script.cta.text });
  }

  for (let i = 0; i < textParts.length; i++) {
    const { id, text } = textParts[i];

    // Resume: skip if already cached
    const cached = cachedAudios.find(a => a.id === id);
    if (cached) {
      items.push(cached);
      onProgress?.({
        step: 'tts',
        current: i + 1,
        total: textParts.length,
        label: `음성 캐시 사용 (${i + 1}/${textParts.length})`
      });
      continue;
    }

    onProgress?.({
      step: 'tts',
      current: i + 1,
      total: textParts.length,
      label: `음성 생성 중... (${i + 1}/${textParts.length})`
    });

    const audioBase64 = await synthesizeSpeech(text, tone, speedRate, voiceName);
    const duration = await getAudioDuration(audioBase64);

    items.push({ id, audioBase64, duration, text });

    if (i < textParts.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_CALLS));
    }
  }

  return items;
}

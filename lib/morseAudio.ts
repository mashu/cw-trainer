import { MORSE_CODE } from './morseConstants';

export interface AudioSettings {
  wpm: number;
  sideTone: number;
  steepness: number;
}

export const ensureContext = async (ctx: AudioContext) => {
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch {}
  }
};

export async function playMorseCode(
  ctx: AudioContext,
  text: string,
  settings: AudioSettings,
  shouldStop: () => boolean
): Promise<number> {
  if (shouldStop()) return 0;

  await ensureContext(ctx);

  const dotDuration = 1.2 / settings.wpm;
  const dashDuration = dotDuration * 3;
  const symbolSpace = dotDuration;
  const charSpace = dotDuration * 3;
  const riseTime = settings.steepness / 1000;

  let currentTime = ctx.currentTime;

  for (let i = 0; i < text.length; i++) {
    if (shouldStop()) return 0;
    const char = text[i].toUpperCase();
    const morse = MORSE_CODE[char];
    if (!morse) continue;
    for (let j = 0; j < morse.length; j++) {
      if (shouldStop()) return 0;
      const symbol = morse[j];
      const duration = symbol === '.' ? dotDuration : dashDuration;

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = settings.sideTone;

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      gainNode.gain.setValueAtTime(0, currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, currentTime + riseTime);
      gainNode.gain.setValueAtTime(0.3, currentTime + duration - riseTime);
      gainNode.gain.linearRampToValueAtTime(0, currentTime + duration);

      oscillator.start(currentTime);
      oscillator.stop(currentTime + duration);

      currentTime += duration + symbolSpace;
    }
    currentTime += charSpace - symbolSpace;
  }

  return currentTime - ctx.currentTime;
}



import type { TrainingSettings } from '@/types';

export type BandConditionsSettings = Pick<
  TrainingSettings,
  | 'sideToneMin'
  | 'sideToneMax'
  | 'qsbEnabled'
  | 'qsbDepth'
  | 'qsbRateHz'
  | 'qrnEnabled'
  | 'qrnLevel'
  | 'qrmEnabled'
  | 'qrmLevel'
  | 'qrmProfile'
  | 'receiverBackgroundGain'
  | 'receiverBackgroundExcitationRate'
  | 'receiverBackgroundResonance'
  | 'receiverBackgroundDecay'
  | 'receiverBackgroundOffsetHz'
  | 'receiverBackgroundOffsetModDepthHz'
  | 'receiverBackgroundOffsetModRateHz'
>;

export interface BandConditionsAudio {
  readonly morseOutput: AudioNode;
  readonly update: (settings: BandConditionsSettings) => void;
  readonly stop: () => void;
}

const NOISE_BUFFER_SECONDS = 2;
const QSB_MIN_GAIN = 0.25;
const QRN_OUTPUT_GAIN = 0.022;
const QRM_OUTPUT_GAIN = 0.11;
const RINGING_OUTPUT_GAIN = 0.08;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const resolveSideTone = (settings: BandConditionsSettings): number => {
  const min = Math.max(100, settings.sideToneMin);
  const max = Math.max(min, settings.sideToneMax);
  return min + (max - min) / 2;
};

const createSettingsSignature = (settings: BandConditionsSettings): string =>
  [
    settings.sideToneMin,
    settings.sideToneMax,
    settings.qsbEnabled,
    settings.qsbDepth,
    settings.qsbRateHz,
    settings.qrnEnabled,
    settings.qrnLevel,
    settings.qrmEnabled,
    settings.qrmLevel,
    settings.qrmProfile,
    settings.receiverBackgroundGain,
    settings.receiverBackgroundExcitationRate,
    settings.receiverBackgroundResonance,
    settings.receiverBackgroundDecay,
    settings.receiverBackgroundOffsetHz,
    settings.receiverBackgroundOffsetModDepthHz,
    settings.receiverBackgroundOffsetModRateHz,
  ].join('|');

const createNoiseSource = (ctx: AudioContext): AudioBufferSourceNode => {
  const frameCount = Math.max(1, Math.floor(ctx.sampleRate * NOISE_BUFFER_SECONDS));
  const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
  const channelData = buffer.getChannelData(0);
  for (let index = 0; index < channelData.length; index += 1) {
    channelData[index] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
};

const createResonatorExcitationSource = (
  ctx: AudioContext,
  excitationRate: number,
  decay: number,
): AudioBufferSourceNode => {
  const frameCount = Math.max(1, Math.floor(ctx.sampleRate * NOISE_BUFFER_SECONDS));
  const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
  const channelData = buffer.getChannelData(0);
  const impulseProbability = clamp(excitationRate, 0.1, 500) / ctx.sampleRate;
  const ringDecay = clamp(decay, 0.5, 0.9999);
  let ringingEnergy = 0;
  let peak = 0;

  for (let index = 0; index < channelData.length; index += 1) {
    if (Math.random() < impulseProbability) {
      ringingEnergy += (Math.random() * 2 - 1) * (0.6 + Math.random() * 0.4);
    }
    ringingEnergy *= ringDecay;
    const grain = ringingEnergy + (Math.random() * 2 - 1) * 0.015;
    channelData[index] = grain;
    peak = Math.max(peak, Math.abs(grain));
  }

  const normalizer = peak > 0 ? 1 / peak : 1;
  for (let index = 0; index < channelData.length; index += 1) {
    channelData[index] = (channelData[index] ?? 0) * normalizer;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
};

const stopSource = (source: AudioScheduledSourceNode): void => {
  try {
    source.stop();
  } catch {
    // Source may already have stopped.
  }
  try {
    source.disconnect();
  } catch {
    // Source may already be disconnected.
  }
};

const disconnectNode = (node: AudioNode): void => {
  try {
    node.disconnect();
  } catch {
    // Node may already be disconnected.
  }
};

const addFrequencyModulation = (
  ctx: AudioContext,
  target: AudioParam,
  depthHz: number,
  rateHz: number,
  activeSources: AudioScheduledSourceNode[],
  activeNodes: AudioNode[],
): void => {
  const depth = clamp(depthHz, 0, 1000);
  const rate = clamp(rateHz, 0, 20);
  if (depth <= 0 || rate <= 0) {
    return;
  }

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(rate, ctx.currentTime);
  gain.gain.setValueAtTime(depth, ctx.currentTime);
  oscillator.connect(gain);
  gain.connect(target);
  oscillator.start();
  activeSources.push(oscillator);
  activeNodes.push(gain);
};

export function createBandConditionsAudio(
  ctx: AudioContext,
  settings: BandConditionsSettings,
): BandConditionsAudio {
  const mixGain = ctx.createGain();
  const cwGain = ctx.createGain();
  mixGain.gain.setValueAtTime(1, ctx.currentTime);
  cwGain.gain.setValueAtTime(1, ctx.currentTime);
  cwGain.connect(mixGain);
  mixGain.connect(ctx.destination);

  let activeSources: AudioScheduledSourceNode[] = [];
  let activeNodes: AudioNode[] = [];
  let currentSettingsSignature = '';

  const stopConditionLayers = (): void => {
    activeSources.forEach(stopSource);
    activeSources = [];
    activeNodes.forEach(disconnectNode);
    activeNodes = [];
    try {
      cwGain.gain.cancelScheduledValues(ctx.currentTime);
      cwGain.gain.setValueAtTime(1, ctx.currentTime);
    } catch {
      // Context may be closed during teardown.
    }
  };

  const addQsb = (nextSettings: BandConditionsSettings): void => {
    if (!nextSettings.qsbEnabled || nextSettings.qsbDepth <= 0) {
      return;
    }

    const depth = clamp(nextSettings.qsbDepth, 0, 1);
    const rate = clamp(nextSettings.qsbRateHz, 0.03, 1.5);
    const gainRange = Math.min(depth, 1 - QSB_MIN_GAIN);
    const baseGain = 1 - gainRange / 2;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();

    cwGain.gain.setValueAtTime(baseGain, ctx.currentTime);
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(rate, ctx.currentTime);
    lfoGain.gain.setValueAtTime(gainRange / 2, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(cwGain.gain);
    lfo.start();

    activeSources.push(lfo);
    activeNodes.push(lfoGain);
  };

  const addQrn = (nextSettings: BandConditionsSettings): void => {
    if (!nextSettings.qrnEnabled || nextSettings.qrnLevel <= 0) {
      return;
    }

    const level = clamp(nextSettings.qrnLevel, 0, 1);
    const centerFrequency = resolveSideTone(nextSettings);
    const source = createNoiseSource(ctx);
    const bandpass = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(centerFrequency, ctx.currentTime);
    bandpass.Q.setValueAtTime(2.4, ctx.currentTime);
    gain.gain.setValueAtTime(QRN_OUTPUT_GAIN * level, ctx.currentTime);

    source.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(mixGain);
    source.start();

    activeSources.push(source);
    activeNodes.push(bandpass, gain);
  };

  const addPassbandQrm = (nextSettings: BandConditionsSettings): void => {
    const level = clamp(nextSettings.qrmLevel, 0, 1);
    const modelGain = clamp(nextSettings.receiverBackgroundGain, 0, 20);
    const resonance = clamp(nextSettings.receiverBackgroundResonance, 0.5, 240);
    const offsetHz = clamp(nextSettings.receiverBackgroundOffsetHz, -1000, 1000);
    const offsetModDepthHz = clamp(nextSettings.receiverBackgroundOffsetModDepthHz, 0, 1000);
    const offsetModRateHz = clamp(nextSettings.receiverBackgroundOffsetModRateHz, 0, 20);
    const centerFrequency = resolveSideTone(nextSettings);
    const source = createResonatorExcitationSource(
      ctx,
      nextSettings.receiverBackgroundExcitationRate,
      nextSettings.receiverBackgroundDecay,
    );
    const primaryBandpass = ctx.createBiquadFilter();
    const secondaryBandpass = ctx.createBiquadFilter();
    const amplitudeLfo = ctx.createOscillator();
    const amplitudeGain = ctx.createGain();
    const gain = ctx.createGain();
    const baseGain = QRM_OUTPUT_GAIN * level * modelGain;

    primaryBandpass.type = 'bandpass';
    primaryBandpass.frequency.setValueAtTime(centerFrequency + offsetHz, ctx.currentTime);
    primaryBandpass.Q.setValueAtTime(resonance, ctx.currentTime);
    secondaryBandpass.type = 'bandpass';
    secondaryBandpass.frequency.setValueAtTime(centerFrequency - Math.max(20, Math.abs(offsetHz) + 35), ctx.currentTime);
    secondaryBandpass.Q.setValueAtTime(Math.max(0.5, resonance * 0.65), ctx.currentTime);
    addFrequencyModulation(
      ctx,
      primaryBandpass.frequency,
      offsetModDepthHz,
      offsetModRateHz,
      activeSources,
      activeNodes,
    );
    addFrequencyModulation(
      ctx,
      secondaryBandpass.frequency,
      offsetModDepthHz * 0.65,
      offsetModRateHz * 0.73,
      activeSources,
      activeNodes,
    );
    amplitudeLfo.type = 'sine';
    amplitudeLfo.frequency.setValueAtTime(0.11, ctx.currentTime);
    amplitudeGain.gain.setValueAtTime(baseGain * 0.18, ctx.currentTime);
    gain.gain.setValueAtTime(baseGain, ctx.currentTime);

    source.connect(primaryBandpass);
    source.connect(secondaryBandpass);
    amplitudeLfo.connect(amplitudeGain);
    amplitudeGain.connect(gain.gain);
    primaryBandpass.connect(gain);
    secondaryBandpass.connect(gain);
    gain.connect(mixGain);
    source.start();
    amplitudeLfo.start();

    activeSources.push(source, amplitudeLfo);
    activeNodes.push(primaryBandpass, secondaryBandpass, amplitudeGain, gain);
  };

  const addRingingQrm = (nextSettings: BandConditionsSettings): void => {
    const level = clamp(nextSettings.qrmLevel, 0, 1);
    const modelGain = clamp(nextSettings.receiverBackgroundGain, 0, 20);
    const resonance = clamp(nextSettings.receiverBackgroundResonance, 0.5, 240);
    const offsetHz = clamp(nextSettings.receiverBackgroundOffsetHz, -1000, 1000);
    const offsetModDepthHz = clamp(nextSettings.receiverBackgroundOffsetModDepthHz, 0, 1000);
    const offsetModRateHz = clamp(nextSettings.receiverBackgroundOffsetModRateHz, 0, 20);
    const centerFrequency = resolveSideTone(nextSettings);
    const source = createResonatorExcitationSource(
      ctx,
      nextSettings.receiverBackgroundExcitationRate,
      nextSettings.receiverBackgroundDecay,
    );
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(centerFrequency + offsetHz - 35, ctx.currentTime);
    filter.Q.setValueAtTime(Math.min(320, resonance * 1.45), ctx.currentTime);
    addFrequencyModulation(
      ctx,
      filter.frequency,
      offsetModDepthHz,
      offsetModRateHz,
      activeSources,
      activeNodes,
    );
    gain.gain.setValueAtTime(RINGING_OUTPUT_GAIN * level * modelGain, ctx.currentTime);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(mixGain);
    source.start();

    activeSources.push(source);
    activeNodes.push(filter, gain);
  };

  const addQrm = (nextSettings: BandConditionsSettings): void => {
    if (!nextSettings.qrmEnabled || nextSettings.qrmLevel <= 0) {
      return;
    }

    if (nextSettings.qrmProfile === 'whistle' || nextSettings.qrmProfile === 'mixed') {
      addPassbandQrm(nextSettings);
    }
    if (nextSettings.qrmProfile === 'ringing' || nextSettings.qrmProfile === 'mixed') {
      addRingingQrm(nextSettings);
    }
  };

  const update = (nextSettings: BandConditionsSettings): void => {
    const nextSignature = createSettingsSignature(nextSettings);
    if (nextSignature === currentSettingsSignature) {
      return;
    }
    stopConditionLayers();
    currentSettingsSignature = nextSignature;
    if (ctx.state === 'closed') {
      return;
    }
    addQsb(nextSettings);
    addQrn(nextSettings);
    addQrm(nextSettings);
  };

  update(settings);

  return {
    morseOutput: cwGain,
    update,
    stop: (): void => {
      stopConditionLayers();
      currentSettingsSignature = '';
      disconnectNode(cwGain);
      disconnectNode(mixGain);
    },
  };
}

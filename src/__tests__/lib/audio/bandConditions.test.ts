import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';
import { createBandConditionsAudio } from '@/lib/audio/bandConditions';

class FakeAudioParam {
  readonly setValueAtTime = jest.fn();
  readonly cancelScheduledValues = jest.fn();
}

class FakeAudioNode {
  readonly connect = jest.fn();
  readonly disconnect = jest.fn();
}

class FakeGainNode extends FakeAudioNode {
  readonly gain = new FakeAudioParam();
}

class FakeOscillatorNode extends FakeAudioNode {
  type: OscillatorType = 'sine';
  readonly frequency = new FakeAudioParam();
  readonly start = jest.fn();
  readonly stop = jest.fn();
}

class FakeBiquadFilterNode extends FakeAudioNode {
  type: BiquadFilterType = 'lowpass';
  readonly frequency = new FakeAudioParam();
  readonly Q = new FakeAudioParam();
}

class FakeBufferSourceNode extends FakeAudioNode {
  buffer: AudioBuffer | null = null;
  loop = false;
  readonly start = jest.fn();
  readonly stop = jest.fn();
}

class FakeAudioContext {
  readonly sampleRate = 8000;
  readonly destination = new FakeAudioNode();
  readonly createdSources: Array<FakeOscillatorNode | FakeBufferSourceNode> = [];
  state: AudioContextState = 'running';

  createGain(): FakeGainNode {
    return new FakeGainNode();
  }

  createOscillator(): FakeOscillatorNode {
    const source = new FakeOscillatorNode();
    this.createdSources.push(source);
    return source;
  }

  createBiquadFilter(): FakeBiquadFilterNode {
    return new FakeBiquadFilterNode();
  }

  createBuffer(_channels: number, frameCount: number, _sampleRate: number): AudioBuffer {
    return ({
      getChannelData: () => new Float32Array(frameCount),
    } as unknown) as AudioBuffer;
  }

  createBufferSource(): FakeBufferSourceNode {
    const source = new FakeBufferSourceNode();
    this.createdSources.push(source);
    return source;
  }
}

describe('createBandConditionsAudio', () => {
  it('creates and stops a disabled ambience graph', () => {
    const ctx = new FakeAudioContext();
    const audio = createBandConditionsAudio(ctx as unknown as AudioContext, {
      ...DEFAULT_TRAINING_SETTINGS,
      qsbEnabled: false,
      qrnEnabled: false,
      qrmEnabled: false,
    });

    expect(audio.morseOutput).toBeDefined();
    expect(ctx.createdSources).toHaveLength(0);

    expect(() => audio.stop()).not.toThrow();
  });

  it('starts and replaces enabled QRN/QRM/QSB layers', () => {
    const ctx = new FakeAudioContext();
    const audio = createBandConditionsAudio(ctx as unknown as AudioContext, {
      ...DEFAULT_TRAINING_SETTINGS,
      qsbEnabled: true,
      qrnEnabled: true,
      qrmEnabled: true,
      qrmProfile: 'mixed',
    });

    expect(ctx.createdSources.length).toBeGreaterThan(0);
    ctx.createdSources.forEach((source) => {
      expect(source.start).toHaveBeenCalled();
    });

    audio.update({
      ...DEFAULT_TRAINING_SETTINGS,
      qsbEnabled: false,
      qrnEnabled: false,
      qrmEnabled: false,
    });

    ctx.createdSources.forEach((source) => {
      expect(source.stop).toHaveBeenCalled();
    });
  });

  it('does not restart condition layers when settings are unchanged', () => {
    const ctx = new FakeAudioContext();
    const settings = {
      ...DEFAULT_TRAINING_SETTINGS,
      qsbEnabled: true,
      qrnEnabled: true,
      qrmEnabled: true,
      qrmProfile: 'mixed' as const,
    };
    const audio = createBandConditionsAudio(ctx as unknown as AudioContext, settings);
    const initialSources = [...ctx.createdSources];

    audio.update(settings);

    expect(ctx.createdSources).toHaveLength(initialSources.length);
    initialSources.forEach((source) => {
      expect(source.stop).not.toHaveBeenCalled();
    });
  });
});

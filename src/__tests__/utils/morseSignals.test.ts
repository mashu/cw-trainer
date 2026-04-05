import {
  decodeMorsePattern,
  isMorseCodePrefix,
  isMorsePrefix,
  keyboardInputToMorseSignal,
  keyToMorseSignal,
} from '@/lib/morseSignals';

describe('morseSignals', () => {
  it('maps keys to morse signals', () => {
    expect(keyToMorseSignal('[')).toBe('.');
    expect(keyToMorseSignal(']')).toBe('-');
    expect(keyToMorseSignal('a')).toBeNull();
  });

  it('maps keyboard codes to morse signals', () => {
    expect(
      keyboardInputToMorseSignal({ code: 'BracketLeft', key: '{' }),
    ).toBe('.');
    expect(
      keyboardInputToMorseSignal({ code: 'BracketRight', key: '}' }),
    ).toBe('-');
    expect(
      keyboardInputToMorseSignal({ code: 'ControlLeft', key: 'Control' }),
    ).toBe('.');
    expect(
      keyboardInputToMorseSignal({ code: 'ControlRight', key: 'Control' }),
    ).toBe('-');
    expect(keyboardInputToMorseSignal({ code: 'KeyA', key: 'a' })).toBeNull();
  });

  it('decodes full morse patterns', () => {
    expect(decodeMorsePattern('.-')).toBe('A');
    expect(decodeMorsePattern('-...')).toBe('B');
    expect(decodeMorsePattern('.-.-')).toBeNull();
  });

  it('checks partial prefixes', () => {
    expect(isMorsePrefix('.---', '.-')).toBe(true);
    expect(isMorsePrefix('.---', '..')).toBe(false);
  });

  it('detects whether a pattern can still extend to a valid character', () => {
    expect(isMorseCodePrefix('')).toBe(true);
    expect(isMorseCodePrefix('.')).toBe(true);
    expect(isMorseCodePrefix('.-')).toBe(true);
    expect(isMorseCodePrefix('...---...')).toBe(false);
  });
});

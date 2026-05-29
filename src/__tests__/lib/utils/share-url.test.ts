import {
  isNavigatorShareCancelled,
  tryCopyTextToClipboard,
  tryNavigatorShare,
} from '@/lib/utils/share-url';

describe('share-url utilities', () => {
  describe('isNavigatorShareCancelled', () => {
    it('returns true for AbortError DOMException', () => {
      const error = new DOMException('Share canceled', 'AbortError');
      expect(isNavigatorShareCancelled(error)).toBe(true);
    });

    it('returns false for other errors', () => {
      expect(isNavigatorShareCancelled(new Error('nope'))).toBe(false);
    });
  });

  describe('tryNavigatorShare', () => {
    const originalShare = navigator.share;

    afterEach(() => {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: originalShare,
      });
    });

    it('returns unavailable when navigator.share is missing', async () => {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: undefined,
      });
      await expect(tryNavigatorShare({ url: 'https://example.com/profile' })).resolves.toBe(
        'unavailable',
      );
    });

    it('returns shared when navigator.share resolves', async () => {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: jest.fn().mockResolvedValue(undefined),
      });
      await expect(tryNavigatorShare({ url: 'https://example.com/profile' })).resolves.toBe(
        'shared',
      );
    });

    it('returns cancelled when navigator.share throws AbortError', async () => {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: jest.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')),
      });
      await expect(tryNavigatorShare({ url: 'https://example.com/profile' })).resolves.toBe(
        'cancelled',
      );
    });

    it('returns unavailable when navigator.share throws a non-abort error', async () => {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: jest.fn().mockRejectedValue(new Error('Share failed')),
      });
      await expect(tryNavigatorShare({ url: 'https://example.com/profile' })).resolves.toBe(
        'unavailable',
      );
    });
  });

  describe('tryCopyTextToClipboard', () => {
    it('uses navigator.clipboard when available', async () => {
      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });

      await expect(tryCopyTextToClipboard('https://example.com/profile')).resolves.toBe(true);
      expect(writeText).toHaveBeenCalledWith('https://example.com/profile');
    });

    it('falls back to execCommand when clipboard.writeText fails', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: jest.fn().mockRejectedValue(new Error('NotAllowedError')),
        },
      });
      const execCommand = jest.fn().mockReturnValue(true);
      Object.defineProperty(document, 'execCommand', {
        configurable: true,
        value: execCommand,
      });

      await expect(tryCopyTextToClipboard('https://example.com/profile')).resolves.toBe(true);
      expect(execCommand).toHaveBeenCalledWith('copy');
    });
  });
});

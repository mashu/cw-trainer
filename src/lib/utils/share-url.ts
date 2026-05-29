export const isNavigatorShareCancelled = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError';

/** Copy text; uses execCommand when Clipboard API fails (e.g. after async work). */
export const tryCopyTextToClipboard = async (text: string): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* Clipboard API may reject without a recent user gesture. */
    }
  }

  if (typeof document === 'undefined') {
    return false;
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
};

export const tryNavigatorShare = async (data: ShareData): Promise<'shared' | 'unavailable' | 'cancelled'> => {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return 'unavailable';
  }

  try {
    await navigator.share(data);
    return 'shared';
  } catch (error) {
    if (isNavigatorShareCancelled(error)) {
      return 'cancelled';
    }
    return 'unavailable';
  }
};

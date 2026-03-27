'use client';

import React, { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallAppBadge(): JSX.Element {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(
      typeof window !== 'undefined' &&
        (window.matchMedia('(display-mode: standalone)').matches ||
          (window.navigator as unknown as { standalone?: boolean }).standalone === true),
    );

    const handler = (e: Event): void => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Register service worker so Chrome considers the app installable and fires beforeinstallprompt
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const base = document.location.pathname.replace(/\/?$/, '') || '';
      const swUrl = `${base}/sw.js`;
      navigator.serviceWorker.register(swUrl).catch(() => {
        // Ignore: may fail if not HTTPS or SW not deployed
      });
    }

    return (): void => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleClick = useCallback((): void => {
    if (installEvent) {
      installEvent.prompt();
      installEvent.userChoice.then(() => setInstallEvent(null));
      return;
    }
    const msg =
      'To install: open the browser menu (⋮) and choose "Install app" or "Add to Home screen".';
    alert(msg);
  }, [installEvent]);

  if (isStandalone) return <></>;

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 transition-colors hover:bg-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
      title="Add to home screen for an app-like experience (Android, iOS, desktop)"
    >
      <span aria-hidden>📱</span>
      Installable app
    </button>
  );
}

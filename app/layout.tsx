import type { Metadata } from 'next';

import './globals.css';

import { LegalBanner } from '@/components/ui/layouts/LegalBanner';
import { LegalFooter } from '@/components/ui/layouts/LegalFooter';

import { Providers } from './providers';

const basePath = process.env['BASE_PATH'] ?? '';

export const metadata: Metadata = {
  title: 'CW Trainer',
  description: 'Train Morse code at your own pace. Track your progress and improve your skills in the browser.',
  manifest: `${basePath}/manifest.json`,
  openGraph: {
    title: 'CW Trainer',
    description: 'Train Morse code at your own pace. Track your progress and improve your skills in the browser.',
    images: [{ url: `${basePath}/icon.svg`, type: 'image/svg+xml' }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Handle chunk loading errors (common with GitHub Pages after deployments)
                if (typeof window !== 'undefined') {
                  function showChunkLoadBanner(message) {
                    try {
                      if (document.getElementById('cw-chunk-load-banner')) return;
                      var banner = document.createElement('div');
                      banner.id = 'cw-chunk-load-banner';
                      banner.style.position = 'fixed';
                      banner.style.left = '12px';
                      banner.style.right = '12px';
                      banner.style.bottom = '12px';
                      banner.style.zIndex = '2147483647';
                      banner.style.padding = '10px 12px';
                      banner.style.borderRadius = '10px';
                      banner.style.border = '1px solid rgba(0,0,0,0.15)';
                      banner.style.background = 'rgba(15, 23, 42, 0.92)'; // slate-900-ish
                      banner.style.color = 'white';
                      banner.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif';
                      banner.style.fontSize = '13px';
                      banner.style.display = 'flex';
                      banner.style.alignItems = 'center';
                      banner.style.justifyContent = 'space-between';
                      banner.style.gap = '12px';
                      banner.innerHTML =
                        '<span style="line-height:1.2;">' +
                        (message || 'A required app file failed to load. You can keep training, but some UI may be broken.') +
                        '</span>' +
                        '<button id="cw-chunk-load-reload" type="button" style="' +
                          'background:#10b981;color:white;border:0;border-radius:8px;padding:8px 10px;' +
                          'font-weight:600;cursor:pointer;white-space:nowrap;' +
                        '">Reload</button>';
                      document.body.appendChild(banner);
                      var btn = document.getElementById('cw-chunk-load-reload');
                      if (btn) {
                        btn.addEventListener('click', function() {
                          window.location.reload();
                        });
                      }
                    } catch (_) {
                      // ignore
                    }
                  }

                  window.addEventListener('error', function(e) {
                    if (e.message && e.message.includes('Failed to load chunk')) {
                      console.warn('[ChunkLoader] Chunk loading error detected, attempting recovery...');
                      // Clear the error to prevent ErrorBoundary from catching it
                      e.preventDefault();
                      // Do NOT auto-reload: it can interrupt an active training session.
                      // Instead, offer a user-triggered reload.
                      showChunkLoadBanner('A required app file failed to load. Click Reload to recover.');
                      return true;
                    }
                  }, true);
                  
                  // Also listen for unhandled promise rejections from chunk loading
                  window.addEventListener('unhandledrejection', function(e) {
                    if (e.reason && typeof e.reason === 'object' && e.reason.message && 
                        (e.reason.message.includes('Failed to load chunk') || 
                         e.reason.message.includes('Loading chunk'))) {
                      console.warn('[ChunkLoader] Chunk loading promise rejection, attempting recovery...');
                      e.preventDefault();
                      // Do NOT auto-reload: it can interrupt an active training session.
                      // Instead, offer a user-triggered reload.
                      showChunkLoadBanner('A required app file failed to load. Click Reload to recover.');
                      return true;
                    }
                  });
                }
              })();
            `,
          }}
        />
      </head>
      <body>
        <Providers>
          <LegalBanner />
          <div>
            {children}
            <LegalFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}

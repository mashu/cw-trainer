import type { Metadata } from 'next';

import './globals.css';

import { LegalBanner } from '@/components/ui/layouts/LegalBanner';
import { LegalFooter } from '@/components/ui/layouts/LegalFooter';

import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'CW Trainer',
  description: 'Train morse code with Koch method',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en">
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



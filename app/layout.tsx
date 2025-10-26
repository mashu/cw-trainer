import type { Metadata } from 'next'
import './global.css'
import LegalBanner from '@/components/LegalBanner'
import LegalFooter from '@/components/LegalFooter'

export const metadata: Metadata = {
  title: 'CW Trainer',
  description: 'Train morse code with Koch method',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <LegalBanner />
        <div>
          {children}
          <LegalFooter />
        </div>
      </body>
    </html>
  )
}

import type { Metadata } from 'next'
import './global.css'

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
      <body>{children}</body>
    </html>
  )
}

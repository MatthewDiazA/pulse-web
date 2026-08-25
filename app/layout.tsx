import type { Metadata } from 'next'
import PageTransition from './components/PageTransition'

export const metadata: Metadata = {
  // Without this, Next resolves /og-image.png against the Vercel deployment URL
  // instead of the real domain. This is what was pointing cards at pulsetx.vercel.app.
  metadataBase: new URL('https://pulsetickets.vip'),
  title: 'pulse',
  description: 'houston. house and electronic.',
  openGraph: {
    title: 'pulse',
    description: 'houston. house and electronic.',
    siteName: 'pulse',
    url: 'https://pulsetickets.vip',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'pulse',
    description: 'houston. house and electronic.',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* suppressHydrationWarning: the browser expands these shorthand styles into
          longhand, which React reads as a mismatch. Cosmetic dev-only warning. */}
      <body suppressHydrationWarning style={{ margin: 0, background: '#000', overflowX: 'hidden' }}>
        <PageTransition>
          {children}
        </PageTransition>
      </body>
    </html>
  )
}
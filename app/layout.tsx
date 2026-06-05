import type { Metadata } from 'next'
import PageTransition from './components/PageTransition'

export const metadata: Metadata = {
  title: 'Pulse',
  openGraph: {
    title: 'Pulse',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pulse',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#000', overflowX: 'hidden' }}>
        <PageTransition>
          {children}
        </PageTransition>
      </body>
    </html>
  )
}
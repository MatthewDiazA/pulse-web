import type { Metadata } from 'next'
import PageTransition from './components/PageTransition'

export const metadata: Metadata = {
  title: 'Pulse — Find Your Night',
  description: 'Discover the best parties, concerts, and events near you. Buy tickets instantly.',
  openGraph: {
    title: 'Pulse',
    description: 'Discover the best parties, concerts, and events near you.',
    images: ['/pulse-logo.png'],
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
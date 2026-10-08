import type { Metadata } from 'next'

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

// Every font the site uses, loaded once from <head> so the browser fetches them right away
// (pages used to @import them from their own <style>, which is discovered late and blocks text).
const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Syne:wght@400;500;600;700;800&family=Nunito:wght@700;800;900&family=DM+Sans:wght@300;400;500&display=swap'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link rel="stylesheet" href={FONTS_URL}/>
      </head>
      {/* suppressHydrationWarning: the browser expands these shorthand styles into
          longhand, which React reads as a mismatch. Cosmetic dev-only warning. */}
      <body suppressHydrationWarning style={{ margin: 0, background: '#000', overflowX: 'hidden' }}>
        {/* No page-wide fade-in wrapper: pages show the moment they arrive, and
            navigation polish comes from the flyer view transition instead. */}
        {children}
      </body>
    </html>
  )
}

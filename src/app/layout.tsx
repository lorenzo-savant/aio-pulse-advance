import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter as GeistSans, JetBrains_Mono as GeistMono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'react-hot-toast'
import { QueryProvider } from '@/providers'
import '@/styles/globals.css'
import { APP_NAME, APP_DESCRIPTION, APP_URL } from '@/lib/constants'

const geistSans = GeistSans({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

const geistMono = GeistMono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: APP_NAME,
    template: `%s — ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  keywords: ['AI search', 'SEO', 'GEO', 'AEO', 'generative engine optimization', 'visibility'],
  authors: [{ name: 'AIO Pulse Team' }],
  creator: 'AIO Pulse',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: APP_URL,
    title: APP_NAME,
    description: APP_DESCRIPTION,
    siteName: APP_NAME,
  },
  twitter: {
    card: 'summary_large_image',
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#080d18' },
  ],
  width: 'device-width',
  initialScale: 1,
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
      lang="en"
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Analytics />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryProvider>{children}</QueryProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              className: 'glass !text-sm !font-medium pop-success',
              duration: 4000,
              success: {
                icon: '✨',
                style: {
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  color: '#0070F3',
                },
              },
              error: {
                icon: '😅',
                style: {
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#EE0000',
                },
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}

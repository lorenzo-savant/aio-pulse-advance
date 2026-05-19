import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter as GeistSans, JetBrains_Mono as GeistMono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'react-hot-toast'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
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

export default async function RootLayout({ children }: RootLayoutProps) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
      lang={locale}
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  '@id': `${APP_URL}/#organization`,
                  name: APP_NAME,
                  url: APP_URL,
                  description: APP_DESCRIPTION,
                  foundingDate: '2024',
                  sameAs: ['https://github.com/Looziolooz/aio-pulse-advance'],
                },
                {
                  '@type': 'WebSite',
                  '@id': `${APP_URL}/#website`,
                  url: APP_URL,
                  name: APP_NAME,
                  description: APP_DESCRIPTION,
                  publisher: { '@id': `${APP_URL}/#organization` },
                  inLanguage: 'en',
                },
              ],
            }),
          }}
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
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
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'The Pick',
  description: 'Daily football betting intelligence',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bg text-white min-h-screen flex flex-col font-sans antialiased">
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border py-4 px-6 text-center text-xs text-neutral-500">
          For entertainment only. Gamble responsibly.{' '}
          <a
            href="https://www.begambleaware.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-neutral-300"
          >
            BeGambleAware.org
          </a>
        </footer>
      </body>
    </html>
  )
}

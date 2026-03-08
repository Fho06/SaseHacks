import type { ReactNode } from 'react'
import { ThemeProvider } from 'next-themes'
import './globals.css'

type RootLayoutProps = {
  children: ReactNode
}

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <div className="light font-sans antialiased">
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        themes={['light', 'dark']}
        storageKey="finvoice-theme"
      >
        {children}
      </ThemeProvider>
    </div>
  )
}

import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ledger — Personal Finance',
  description: 'Track your money with clarity. Personal expense, budget, and savings tracker.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}

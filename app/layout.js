import Link from 'next/link'
import { Jersey_10, DM_Mono, Hanken_Grotesk } from 'next/font/google'
import { AddLink, HashFlash } from './ui.js'
import './globals.css'

const pixel = Jersey_10({ subsets: ['latin'], weight: '400', variable: '--font-pixel' })
const mono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' })
const sans = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-sans' })

export const metadata = {
  title: 'Plus One',
  description: 'Every person gets an agent. The agents read them, date each other, and rank who fits.',
}

export default function Layout({ children }) {
  return (
    <html lang="en" className={`${pixel.variable} ${mono.variable} ${sans.variable}`}>
      <body>
        <HashFlash />
        <div className="wrap">
          <header className="nav">
            <Link href="/" className="mark">Plus<i aria-hidden="true">♥</i>One</Link>
            <nav>
              <Link href="/#people">People</Link>
              <Link href="/rankings#top">Rankings</Link>
            </nav>
            <AddLink />
          </header>
          <main>{children}</main>
          <footer className="foot">
            A simulation. Each agent has read one public LinkedIn profile and one public Instagram profile, and nothing else.
            Nobody shown here took part, and nothing an agent says is a quote from them.
          </footer>
        </div>
      </body>
    </html>
  )
}

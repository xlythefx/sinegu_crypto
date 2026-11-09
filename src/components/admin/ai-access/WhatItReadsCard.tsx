import { EyeOff, ScanSearch } from 'lucide-react'
import type { AiToolInfo } from '../../../types/aiAccess'

interface WhatItReadsCardProps {
  tools: AiToolInfo[]
  delay?: number
}

const NEVER = [
  'Exchange API keys and secrets',
  'Passwords, login sessions and reset codes',
  'Email addresses and IP addresses of customers',
  'Any way to place, close or change anything',
]

/**
 * What a key opens, in the tools' own titles (from the API, so a new tool
 * shows up here without a frontend change), and what it never does.
 */
export default function WhatItReadsCard({ tools, delay }: WhatItReadsCardProps) {
  return (
    <section
      className="grid min-w-0 grid-cols-1 gap-4 rounded-card border border-border bg-surface p-card lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] max-[480px]:p-3.5"
      data-aos="fade-up"
      data-aos-delay={delay}
      aria-labelledby="ai-reads"
    >
      <div className="min-w-0">
        <h2 id="ai-reads" className="flex items-center gap-2 font-display text-[16px] font-extrabold text-text">
          <ScanSearch size={17} className="text-accent" aria-hidden="true" />
          What the AI can read
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {tools.map((t) => (
            <li key={t.name} className="rounded-row border border-hair bg-surface2 px-3.5 py-2.5">
              <details className="group">
                <summary className="cursor-pointer list-none text-[13px] font-bold text-text marker:hidden">
                  {t.title}
                  <span className="ml-1.5 font-normal text-faint group-open:hidden">· more</span>
                </summary>
                <p className="mt-1.5 text-[12.5px] leading-[1.55] text-muted">{t.description}</p>
              </details>
            </li>
          ))}
        </ul>
      </div>
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 font-display text-[14px] font-extrabold text-text">
          <EyeOff size={15} className="text-red" aria-hidden="true" />
          Never shared
        </h3>
        <ul className="mt-3 flex flex-col gap-1.5">
          {NEVER.map((n) => (
            <li key={n} className="text-[12.5px] leading-[1.5] text-muted">
              — {n}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] leading-[1.55] text-faint">
          Customer names, balances and P&amp;L ARE shared, by the owner’s decision. Whatever the AI reads is sent to its
          provider (xAI for Grok).
        </p>
      </div>
    </section>
  )
}

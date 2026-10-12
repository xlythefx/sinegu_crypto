import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { OFFER_FAQ } from '../../lib/binanceOffer'

/** One answer open at a time, like the main FAQ page. */
export default function OfferFaq() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="rounded-card border border-border bg-surface px-6 max-[560px]:px-5">
      {OFFER_FAQ.map((entry, i) => {
        const isOpen = open === i
        return (
          <div key={entry.q} className="border-t border-hair first:border-t-0">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-5 py-5 text-left"
            >
              <span
                className={`text-[15.5px] font-bold leading-snug transition-colors ${
                  isOpen ? 'text-accent' : 'text-text'
                }`}
              >
                {entry.q}
              </span>
              <ChevronDown
                size={18}
                className={`shrink-0 text-faint transition-transform duration-200 ${
                  isOpen ? 'rotate-180 text-accent' : ''
                }`}
              />
            </button>
            {isOpen && (
              <p className="animate-[fadeup_0.25s_ease-out] max-w-[72ch] pb-6 text-[15px] leading-[1.8] text-muted">
                {entry.a}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

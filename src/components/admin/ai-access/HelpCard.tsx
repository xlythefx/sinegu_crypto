import { LifeBuoy, Lightbulb } from 'lucide-react'

interface HelpCardProps {
  delay?: number
}

const TIPS: { tip: string; example?: string }[] = [
  {
    tip: 'Start with “Using Pixel Alpha” so Grok asks the platform instead of searching the web.',
    example: 'Using Pixel Alpha, how many LTC signals came in this month?',
  },
  {
    tip: 'Name the period. Days are counted in UTC, the same as the admin pages.',
    example: '…in October? …over the last 7 days? …yesterday?',
  },
  {
    tip: 'Name the coin, person or exchange when you mean one.',
    example: 'How much did Juan make on MEXC last week?',
  },
  {
    tip: 'Ask for the total first, then the list. Follow-up questions keep the same filters.',
    example: 'Who is overdue? → And how many days overdue is each one?',
  },
  {
    tip: 'Check an answer under “What it asked” on this page: every look-up shows the filters Grok used, and the figures are the same ones the admin pages show.',
  },
]

const PROBLEMS: { symptom: string; fix: string }[] = [
  {
    symptom: 'Grok says the key is not valid, has expired or was revoked',
    fix: 'Check the key’s status in the Keys card above. An expired or revoked key cannot come back: create a new one, then edit the connector in Grok and paste the new key as the header value.',
  },
  {
    symptom: 'Grok says to send the key in the X-Api-Key header',
    fix: 'The key was pasted into the Server URL. Put the plain URL in Server URL, and the key under HTTP headers (Key “X-Api-Key”, Value the key).',
  },
  {
    symptom: 'Grok says there are too many questions for this key',
    fix: 'Each key may make 60 look-ups a minute and 3,000 a day, and one question can take several look-ups. Wait the number of seconds it names and ask again.',
  },
  {
    symptom: 'Grok answers in general terms, without Pixel Alpha’s figures',
    fix: 'Make sure the Pixel Alpha connector is switched on for that chat, and start the question with “Using Pixel Alpha”. If nothing appears under “What it asked”, Grok never called it.',
  },
  {
    symptom: 'Grok cannot connect at all, and nothing appears under “What it asked”',
    fix: 'Check the Server URL is exactly the one in the Connect Grok card (https, ending in /api/mcp) and Client ID is empty. If it still fails, the website’s firewall may be stopping Grok’s servers — tell the developer the time you tried.',
  },
  {
    symptom: 'Grok says the answer is too big, or to narrow the question',
    fix: 'Ask about a shorter period, one coin or one person, or ask for totals instead of every row.',
  },
  {
    symptom: 'A key was shared by mistake',
    fix: 'Revoke it in the Keys card. It stops working at once, everywhere. Then create a new key for the person who should have it.',
  },
]

/**
 * How to get good answers out of the connector and what to do when it
 * misbehaves — the symptoms are the API's own refusals (VerifyAiAccessKey,
 * AiTools), in the words Grok repeats back to the person asking.
 */
export default function HelpCard({ delay }: HelpCardProps) {
  return (
    <section
      className="grid min-w-0 grid-cols-1 gap-5 rounded-card border border-border bg-surface p-card lg:grid-cols-2 max-[480px]:p-3.5"
      data-aos="fade-up"
      data-aos-delay={delay}
      aria-labelledby="ai-help"
    >
      <div className="min-w-0">
        <h2 id="ai-help" className="flex items-center gap-2 font-display text-[16px] font-extrabold text-text">
          <Lightbulb size={17} className="text-accent" aria-hidden="true" />
          Asking good questions
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {TIPS.map((t) => (
            <li key={t.tip} className="rounded-row border border-hair bg-surface2 px-3.5 py-2.5">
              <p className="text-[13px] leading-[1.55] text-text">{t.tip}</p>
              {t.example && <p className="mt-1 text-[12.5px] leading-[1.5] text-muted">“{t.example}”</p>}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] leading-[1.55] text-faint">
          Grok reads what the platform has stored — signals, trades, balances from the last sync, invoices. It cannot
          place or close a trade, change a setting or mark an invoice paid.
        </p>
      </div>

      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-display text-[16px] font-extrabold text-text">
          <LifeBuoy size={17} className="text-teal" aria-hidden="true" />
          If something goes wrong
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {PROBLEMS.map((p) => (
            <li key={p.symptom} className="rounded-row border border-hair bg-surface2 px-3.5 py-2.5">
              <details className="group">
                <summary className="cursor-pointer list-none text-[13px] font-bold leading-[1.5] text-text marker:hidden">
                  {p.symptom}
                  <span className="ml-1.5 font-normal text-faint group-open:hidden">· fix</span>
                </summary>
                <p className="mt-1.5 text-[12.5px] leading-[1.55] text-muted">{p.fix}</p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

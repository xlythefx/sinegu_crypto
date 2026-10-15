import { ListTree } from 'lucide-react'

interface Field {
  name: string
  required: boolean
  text: string
}

/**
 * What a signal's JSON may carry. `target_uni_ids` is deliberately absent:
 * it narrows the fan-out to chosen users and belongs to the admin console
 * only, never to an alert.
 */
const FIELDS: Field[] = [
  {
    name: 'secret',
    required: true,
    text: 'The feed’s webhook secret. A wrong or missing one is refused (403).',
  },
  {
    name: 'action',
    required: true,
    text: 'BUY | SELL | EXIT_LONG | EXIT_SHORT. Exits close whatever is open and skip every size and asset check.',
  },
  {
    name: 'symbol',
    required: true,
    text: 'The coin, e.g. LTCUSDT. A “BINANCE:” prefix and a “.P” suffix are stripped, so {{ticker}} works as-is.',
  },
  {
    name: 'price',
    required: false,
    text: 'Informational only — sizing uses the live mark price.',
  },
  {
    name: 'leverage',
    required: false,
    text: '1–125. Leave it out to let the engine decide.',
  },
  {
    name: 'strategy',
    required: false,
    text: 'A free label stored on the position, so the closing trade keeps it.',
  },
]

/** The field reference under both feeds — the same contract on every address. */
export default function MessageFieldsCard({ delay }: { delay?: number }) {
  return (
    <section
      className="flex min-w-0 flex-col gap-4 rounded-card border border-border bg-surface p-card max-[480px]:p-3.5"
      data-aos="fade-up"
      data-aos-delay={delay}
      aria-labelledby="webhook-fields"
    >
      <header className="flex items-start gap-3">
        <span
          className="grid h-9 w-9 flex-none place-items-center rounded-[10px] border border-border bg-surface2 text-muted"
          aria-hidden="true"
        >
          <ListTree size={17} />
        </span>
        <div className="min-w-0">
          <h2 id="webhook-fields" className="font-display text-[16px] font-extrabold text-text">
            Message fields
          </h2>
          <p className="mt-0.5 text-[12.5px] leading-[1.55] text-muted">
            The same fields on every address, main or test.
          </p>
        </div>
      </header>

      <dl className="flex flex-col overflow-hidden rounded-row border border-hair">
        {FIELDS.map((f, i) => (
          <div
            key={f.name}
            className={`grid grid-cols-1 gap-1.5 px-4 py-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4 ${
              i ? 'border-t border-hair' : ''
            }`}
          >
            <dt className="flex flex-wrap items-center gap-2">
              <code className="font-mono text-[12.5px] font-bold text-text">{f.name}</code>
              <span
                className={`rounded-pill border px-2 py-px text-[10.5px] font-semibold ${
                  f.required ? 'border-accent-line bg-accent-soft text-accent' : 'border-hair bg-surface2 text-faint'
                }`}
              >
                {f.required ? 'required' : 'optional'}
              </span>
            </dt>
            <dd className="m-0 text-[12.5px] leading-[1.55] text-muted">{f.text}</dd>
          </div>
        ))}
      </dl>

      <p className="text-[12.5px] leading-[1.55] text-muted">
        Any signal provider works, not only TradingView: it just has to POST this JSON to the
        address.
      </p>
    </section>
  )
}

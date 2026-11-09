import { Plug } from 'lucide-react'
import ConnectorField from './ConnectorField'
import type { AiConnectorSettings } from '../../../types/aiAccess'

interface ConnectGrokCardProps {
  connector: AiConnectorSettings
}

const EXAMPLES = [
  'How many LTC signals came in this month?',
  'Which assets are up over the last 30 days?',
  'Who hasn’t paid their invoice, and who is overdue?',
  'Why didn’t Juan get yesterday’s BTC entry?',
  'What was our best day in October?',
]

/**
 * The four fields of Grok's "Add a custom connector" form, in its own order,
 * each with what to type. The key itself is never on this card — it is shown
 * once when made, in the Keys card below.
 */
export default function ConnectGrokCard({ connector }: ConnectGrokCardProps) {
  return (
    <section
      className="flex min-w-0 flex-col gap-4 rounded-card border border-border bg-surface p-card max-[480px]:p-3.5"
      data-aos="fade-up"
      aria-labelledby="ai-connect"
    >
      <header className="flex items-start gap-3">
        <span
          className="grid h-9 w-9 flex-none place-items-center rounded-[10px] border border-accent-line bg-accent-soft text-accent"
          aria-hidden="true"
        >
          <Plug size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="ai-connect" className="font-display text-[16px] font-extrabold text-text">
            Connect Grok
          </h2>
          <p className="mt-0.5 text-[12.5px] leading-[1.55] text-muted">
            In the Grok app: <strong className="text-text">Connectors → New connector → Custom</strong>, then fill the
            form like this. Grok can then read trades, assets, accounts and billing — it can never change anything.
          </p>
        </div>
      </header>

      <div className="grid min-w-0 grid-cols-1 gap-3.5 md:grid-cols-2">
        <ConnectorField label="Name" value="Pixel Alpha" />
        <ConnectorField label="Type" value={connector.type} note />
        <div className="md:col-span-2">
          <ConnectorField label="Server URL" value={connector.server_url} />
        </div>
        <ConnectorField label="HTTP headers — Key" value={connector.header_name} />
        <ConnectorField label="HTTP headers — Value" value="The key you create below (starts with pxa_)" note />
        <div className="md:col-span-2">
          <ConnectorField label="Client ID" value="Leave empty." note />
        </div>
      </div>

      <div className="rounded-row border border-hair bg-surface2 p-3.5">
        <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-faint">Then ask, for example</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {EXAMPLES.map((q) => (
            <li key={q} className="text-[13px] leading-[1.5] text-text">
              “{q}”
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

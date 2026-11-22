import { RefreshCw } from 'lucide-react'
import { Pill } from '../../ui/Pill'
import { fmtAgo } from '../../../lib/format'
import type { AdminDevBotData } from '../../../types/adminDevBot'

const CARD = 'flex min-w-0 flex-col gap-4 rounded-card border border-border bg-surface p-card max-[480px]:p-3.5'

const DOT = { true: 'bg-green', false: 'bg-red', null: 'bg-muted' } as const

interface StatusCardProps {
  data: AdminDevBotData
  refreshing: boolean
  onRefresh: () => void
}

/** The same service checks as the bot's /status, read on the server just now. */
export default function StatusCard({ data, refreshing, onRefresh }: StatusCardProps) {
  const problems = data.checks.filter((c) => c.ok === false).length
  const { bot, agent } = data

  return (
    <section className={CARD} data-aos="fade-up" aria-labelledby="errorbot-status">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 basis-[240px]">
          <h2 id="errorbot-status" className="font-display text-[16px] font-extrabold text-text">
            {problems === 0 ? 'All services up' : `${problems} service${problems === 1 ? '' : 's'} with a problem`}
          </h2>
          <p className="mt-1 text-[12.5px] leading-[1.5] text-muted">
            What /status answers in Telegram. Checked on the server, so it works with the PC off.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex min-h-9 flex-none cursor-pointer items-center gap-1.5 rounded-[9px] border border-border bg-surface2 px-3 text-[12px] font-semibold text-muted transition-[border-color,color] duration-150 disabled:opacity-50 enabled:hover:border-accent enabled:hover:text-text"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : undefined} aria-hidden="true" />
          Refresh
        </button>
      </header>

      <ul className="flex flex-col divide-y divide-border rounded-[10px] border border-border">
        {data.checks.map((c) => (
          <li key={c.key} className="flex items-start gap-3 px-3.5 py-3">
            <span className={`mt-[6px] h-2 w-2 flex-none rounded-full ${DOT[String(c.ok) as keyof typeof DOT]}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-text">{c.name}</div>
              <div className="mt-0.5 break-words text-[12.5px] leading-[1.5] text-muted">{c.detail}</div>
            </div>
            <span className="sr-only">{c.ok === true ? 'working' : c.ok === false ? 'problem' : 'unknown'}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-muted">
        <span className="inline-flex items-center gap-2">
          Bot
          <Pill tone={bot.configured ? 'green' : 'red'}>{bot.configured ? 'Connected' : 'Not set up'}</Pill>
        </span>
        <span className="inline-flex items-center gap-2">
          Buttons
          <Pill tone={bot.webhook_url && !bot.webhook_error ? 'green' : bot.webhook_url ? 'accent' : 'red'}>
            {bot.webhook_url ? (bot.webhook_error ? 'Last call failed' : 'Working') : 'Not connected'}
          </Pill>
        </span>
        <span className="inline-flex items-center gap-2">
          PC agent
          <Pill tone={agent.paused ? 'accent' : agent.online ? 'green' : 'muted'}>
            {agent.paused ? 'Paused' : agent.online ? 'Online' : 'Offline'}
          </Pill>
          <span>last check-in {fmtAgo(agent.last_seen_at)}</span>
        </span>
      </div>
      {bot.webhook_error && (
        <p className="text-[12px] leading-[1.5] text-red">Telegram’s last error reaching the server: {bot.webhook_error}</p>
      )}
    </section>
  )
}

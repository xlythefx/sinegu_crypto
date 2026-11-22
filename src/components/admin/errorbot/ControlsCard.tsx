import { useState } from 'react'
import { BellOff, Send } from 'lucide-react'
import ConfirmModal from '../../ui/ConfirmModal'
import ToggleSwitch from '../creatives/ToggleSwitch'
import { fmtDateTime } from '../../../lib/format'
import type { AdminDevBotData, DevBotSettingsPatch } from '../../../types/adminDevBot'

const CARD = 'flex min-w-0 flex-col gap-5 rounded-card border border-border bg-surface p-card max-[480px]:p-3.5'
const BTN =
  'inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[9px] border border-border bg-surface2 px-3 text-[12.5px] font-semibold text-text transition-[border-color] duration-150 disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:border-accent'
const SUBHEAD = 'text-[11px] font-bold uppercase tracking-[0.06em] text-muted'

const MUTES = [
  { minutes: 60, label: '1 hour' },
  { minutes: 480, label: '8 hours' },
  { minutes: 1440, label: '24 hours' },
] as const

interface ControlsCardProps {
  data: AdminDevBotData
  onPatch: (patch: DevBotSettingsPatch) => Promise<void>
  onTest: () => Promise<void>
}

/** What the bot may say first, a mute, the PC agent's pause and a test message. */
export default function ControlsCard({ data, onPatch, onTest }: ControlsCardProps) {
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmPause, setConfirmPause] = useState(false)
  const { settings, kinds } = data
  const disabled = new Set(settings.disabled_kinds)

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
    } finally {
      setBusy(null)
    }
  }

  const toggleKind = (key: string, on: boolean) => {
    const next = on ? settings.disabled_kinds.filter((k) => k !== key) : [...settings.disabled_kinds, key]
    void run(`kind:${key}`, () => onPatch({ disabled_kinds: next }))
  }

  return (
    <section className={CARD} data-aos="fade-up" data-aos-delay={80} aria-labelledby="errorbot-controls">
      <header>
        <h2 id="errorbot-controls" className="font-display text-[16px] font-extrabold text-text">
          What the bot sends
        </h2>
        <p className="mt-1 text-[12.5px] leading-[1.5] text-muted">
          Switches for messages the bot sends by itself. Answers to you (/status, a job’s result, a button you
          tapped) always arrive.
        </p>
      </header>

      <div className="flex flex-col gap-2.5">
        <div className={SUBHEAD}>Mute everything</div>
        {settings.muted_until ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-accent">
              <BellOff size={15} aria-hidden="true" /> Muted until {fmtDateTime(settings.muted_until)}
            </span>
            <button type="button" className={BTN} disabled={busy !== null} onClick={() => void run('mute', () => onPatch({ mute_minutes: 0 }))}>
              Unmute now
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {MUTES.map((m) => (
              <button key={m.minutes} type="button" className={BTN} disabled={busy !== null}
                onClick={() => void run('mute', () => onPatch({ mute_minutes: m.minutes }))}>
                <BellOff size={14} aria-hidden="true" /> {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <div className={SUBHEAD}>Kinds of message</div>
        <ul className="flex flex-col divide-y divide-border">
          {kinds.map((k) => (
            <li key={k.key} className="flex items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-bold text-text">{k.label}</div>
                <div className="mt-0.5 text-[12.5px] leading-[1.5] text-muted">{k.description}</div>
              </div>
              <ToggleSwitch on={!disabled.has(k.key)} label={k.label} busy={busy === `kind:${k.key}`}
                disabled={busy !== null && busy !== `kind:${k.key}`} onChange={(on) => toggleKind(k.key, on)} />
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className={SUBHEAD}>PC developer agent</div>
        <div className="flex items-start gap-3">
          <p className="min-w-0 flex-1 text-[12.5px] leading-[1.5] text-muted">
            Works the Investigate jobs and deploys on your computer. Paused, it still checks in but takes no new
            job; queued jobs wait for you to resume it.
          </p>
          <ToggleSwitch on={!settings.agent_paused} label="PC agent working" busy={busy === 'agent'}
            disabled={busy !== null && busy !== 'agent'}
            onChange={(on) => (on ? void run('agent', () => onPatch({ agent_paused: false })) : setConfirmPause(true))} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <button type="button" className={BTN} disabled={busy !== null || !data.bot.configured} onClick={() => void run('test', onTest)}>
          <Send size={14} aria-hidden="true" /> Send a test message
        </button>
        {settings.updated_by && settings.updated_at && (
          <span className="text-[12px] text-muted">
            Last changed by {settings.updated_by}, {fmtDateTime(settings.updated_at)}
          </span>
        )}
      </div>

      <ConfirmModal
        open={confirmPause}
        title="Pause the PC agent?"
        message="It stops taking Investigate jobs and deploys until you resume it. Jobs sent meanwhile wait in the queue."
        confirmLabel="Pause"
        onCancel={() => setConfirmPause(false)}
        onConfirm={() => {
          setConfirmPause(false)
          void run('agent', () => onPatch({ agent_paused: true }))
        }}
      />
    </section>
  )
}

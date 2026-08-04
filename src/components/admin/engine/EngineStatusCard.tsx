import { useState } from 'react'
import { AlertTriangle, Info, RotateCcw } from 'lucide-react'
import ConfirmModal from '../../ui/ConfirmModal'
import { CARD, NOTE_ERROR, NOTE_WARN } from './classes'
import type { AdminEngineStatus, EngineState } from '../../../types/admin'

interface StateDisplay {
  label: string
  dot: string
  text: string
}

const STATE_DISPLAY: Record<EngineState, StateDisplay> = {
  active: {
    label: 'RUNNING',
    dot: 'bg-green shadow-[0_0_0_4px_color-mix(in_srgb,var(--green)_20%,transparent)]',
    text: 'text-green',
  },
  inactive: {
    label: 'STOPPED',
    dot: 'bg-red shadow-[0_0_0_4px_color-mix(in_srgb,var(--red)_20%,transparent)]',
    text: 'text-red',
  },
  failed: {
    label: 'FAILED',
    dot: 'bg-red shadow-[0_0_0_4px_color-mix(in_srgb,var(--red)_20%,transparent)]',
    text: 'text-red',
  },
  activating: {
    label: 'STARTING',
    dot: 'bg-accent shadow-[0_0_0_4px_var(--glow)]',
    text: 'text-accent',
  },
}

const UNKNOWN_DISPLAY: StateDisplay = {
  label: 'UNKNOWN',
  dot: 'bg-faint',
  text: 'text-muted',
}

function stateDisplay(status: AdminEngineStatus): StateDisplay {
  if (status.state && STATE_DISPLAY[status.state]) {
    return STATE_DISPLAY[status.state]
  }
  if (!status.available) {
    return { label: 'LOCAL DEV', dot: 'bg-faint', text: 'text-muted' }
  }
  return UNKNOWN_DISPLAY
}

const RESTART_BTN =
  'inline-flex items-center gap-2 h-10 rounded-pill border border-[color-mix(in_srgb,var(--red)_45%,transparent)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)] px-[18px] text-[13px] font-bold text-red transition-colors duration-150 hover:bg-red hover:border-red hover:text-white disabled:opacity-55 disabled:cursor-not-allowed'

interface EngineStatusCardProps {
  status: AdminEngineStatus
  restarting: boolean
  restartError: string | null
  onRestart: () => void
}

/** Big service state (pulsing dot + label), unit name, and the restart action. */
export default function EngineStatusCard({
  status,
  restarting,
  restartError,
  onRestart,
}: EngineStatusCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const d = stateDisplay(status)

  return (
    <section className={CARD} data-aos="fade-up">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <span
            className={`w-3 h-3 flex-none rounded-full ${d.dot} animate-[pulse_1.8s_ease-in-out_infinite]`}
          />
          <div className="min-w-0">
            <div
              className={`font-display text-[24px] font-extrabold tracking-[-0.4px] leading-[1.1] max-[560px]:text-[20px] ${d.text}`}
            >
              {d.label}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-muted">
              <span className="font-mono">{status.service}</span>
              {status.active_since && (
                <>
                  <span className="text-faint">·</span>
                  <span>since {status.active_since}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {status.available ? (
          <button
            type="button"
            className={RESTART_BTN}
            onClick={() => setConfirmOpen(true)}
            disabled={restarting}
          >
            <RotateCcw
              size={15}
              className={
                restarting ? 'animate-[dstate-spin_0.8s_linear_infinite]' : ''
              }
            />
            {restarting ? 'Restarting…' : 'Restart engine'}
          </button>
        ) : (
          <p className="text-[12.5px] text-muted">
            Engine control runs on the prod server only.
          </p>
        )}
      </div>

      {status.message && (
        <div className={`mt-4 ${NOTE_WARN}`}>
          <Info size={15} className="flex-none mt-px" />
          <span>{status.message}</span>
        </div>
      )}

      {restartError && (
        <div className={`mt-4 ${NOTE_ERROR}`}>
          <AlertTriangle size={15} className="flex-none mt-px" />
          <span>{restartError}</span>
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        title="Restart the trading engine?"
        message="The engine will stop and start again. Signal processing and the exchange pollers pause for a few seconds while it comes back up."
        confirmLabel="Yes, restart"
        cancelLabel="No"
        danger
        onConfirm={() => {
          setConfirmOpen(false)
          onRestart()
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  )
}

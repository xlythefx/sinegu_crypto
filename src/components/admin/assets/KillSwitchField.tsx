import { useId } from 'react'
import { ShieldAlert } from 'lucide-react'
import {
  KILL_SWITCH_MAX,
  KILL_SWITCH_MIN,
  killDraftError,
  type KillSwitchDraft,
} from '../../../lib/killSwitch'

const COUNT_BOX =
  'mx-1 inline-block h-8 w-12 rounded-field border bg-surface px-1 text-center align-middle font-mono text-[13px] font-semibold text-text outline-none focus:border-accent disabled:cursor-not-allowed'

interface KillSwitchFieldProps {
  value: KillSwitchDraft
  onChange: (next: KillSwitchDraft) => void
  disabled?: boolean
  /** "LTC/USDT" — names the switch for screen readers. */
  symbol?: string
}

/**
 * The kill switch editor, shared by the Streak Sizing Settings card and the
 * asset form: on/off plus "if the master loses [3] trades in a row". It is
 * its own red-edged block because it does something of a different order
 * from the steps above it — it switches the coin off for EVERYONE — and it
 * works whether streak sizing is on or off.
 *
 * Controlled; the count is kept as typed (and remembered while off) so
 * switching it off and on again does not lose it.
 */
export default function KillSwitchField({
  value,
  onChange,
  disabled = false,
  symbol,
}: KillSwitchFieldProps) {
  const id = useId()
  const error = killDraftError(value)
  const on = value.on

  return (
    <section
      className={`flex flex-col gap-3 rounded-row border p-3.5 transition-[background,border-color] duration-150 ${
        on
          ? 'border-[color-mix(in_srgb,var(--red)_38%,transparent)] bg-[color-mix(in_srgb,var(--red)_6%,transparent)]'
          : 'border-[color-mix(in_srgb,var(--red)_22%,transparent)] bg-surface2'
      }`}
      aria-labelledby={`${id}-title`}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 flex-none place-items-center rounded-[10px] bg-[color-mix(in_srgb,var(--red)_14%,transparent)] text-red">
          <ShieldAlert size={15} aria-hidden="true" />
        </span>
        <p id={`${id}-title`} className="min-w-0 flex-1 text-[13px] font-bold text-text">
          Kill switch
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={symbol ? `Kill switch for ${symbol}` : 'Kill switch'}
          className="inline-flex flex-none items-center gap-2 rounded-pill bg-transparent py-1 pl-2 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onChange({ ...value, on: !on })}
          disabled={disabled}
        >
          <span className={`text-[12.5px] font-semibold ${on ? 'text-red' : 'text-muted'}`}>
            {on ? 'On' : 'Off'}
          </span>
          <span
            className={`relative inline-block h-5 w-9 flex-none rounded-pill border transition-[background,border-color] duration-150 ${
              on
                ? 'border-red bg-[color-mix(in_srgb,var(--red)_16%,transparent)]'
                : 'border-border bg-surface'
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-[14px] w-[14px] rounded-full transition-[transform,background] duration-150 ${
                on ? 'translate-x-4 bg-red' : 'bg-muted'
              }`}
            />
          </span>
        </button>
      </div>

      <label
        className={`text-[12.5px] font-semibold leading-[2.1] text-text transition-opacity duration-150 ${
          on ? '' : 'opacity-60'
        }`}
      >
        Switch this coin off for everyone if the master loses
        <input
          type="number"
          inputMode="numeric"
          min={KILL_SWITCH_MIN}
          max={KILL_SWITCH_MAX}
          step={1}
          className={`${COUNT_BOX} ${error ? 'border-red' : 'border-border'}`}
          value={value.count}
          onChange={(e) => onChange({ ...value, count: e.target.value })}
          disabled={disabled}
          aria-invalid={error !== null}
          aria-describedby={error ? `${id}-error` : `${id}-help`}
        />
        trades in a row
      </label>

      {error && (
        <p id={`${id}-error`} className="-mt-1.5 text-[11.5px] font-semibold text-red" role="alert">
          {error}
        </p>
      )}

      <p id={`${id}-help`} className="text-[11.5px] leading-[1.55] text-faint">
        Counts the master’s trades only, from the moment you switch this on or turn the coin back
        on. Open positions still close normally. You turn the coin back on yourself on the Assets
        tab. Works on its own, even while streak sizing is off.
      </p>
    </section>
  )
}

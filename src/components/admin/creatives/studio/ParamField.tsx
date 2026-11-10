import { FIELD, HINT, INPUT, LABEL, SELECT } from '../../../settings/formClasses'
import { paramOptionLabel } from '../../../../lib/creatives'
import type { CreativeModelParam, CreativeParamValue } from '../../../../types/creatives'

interface ParamFieldProps {
  param: CreativeModelParam
  value: CreativeParamValue | undefined
  onChange: (value: CreativeParamValue) => void
  disabled?: boolean
}

/**
 * One model parameter, drawn from its type: a select keeps each option's own
 * type (a duration of 5 goes back as the number 5, not "5"), an integer is a
 * number box with its range, a boolean a checkbox, text a single line.
 */
export default function ParamField({ param, value, onChange, disabled }: ParamFieldProps) {
  if (param.type === 'boolean') {
    return (
      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-field border border-border bg-surface2 px-3 py-2.5 @sm:col-span-2">
        <input
          type="checkbox"
          className="h-[18px] w-[18px] flex-none cursor-pointer accent-[var(--accent)]"
          checked={value === true}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="text-[13px] font-semibold text-text">{param.label}</span>
      </label>
    )
  }

  if (param.type === 'select') {
    const options = param.options ?? []
    return (
      <label className={FIELD}>
        <span className={LABEL}>{param.label}</span>
        <select
          className={SELECT}
          value={value === null || value === undefined ? '' : String(value)}
          disabled={disabled}
          onChange={(e) => {
            const picked = options.find((o) => String(o) === e.target.value)
            onChange(picked ?? null)
          }}
        >
          {(value === null || value === undefined) && <option value="">Model default</option>}
          {options.map((o) => (
            <option key={String(o)} value={String(o)}>
              {paramOptionLabel(param.name, o)}
            </option>
          ))}
        </select>
      </label>
    )
  }

  if (param.type === 'integer') {
    const range =
      param.min !== undefined && param.max !== undefined
        ? `${param.min}–${param.max}`
        : param.min !== undefined
          ? `at least ${param.min}`
          : param.max !== undefined
            ? `at most ${param.max}`
            : null
    return (
      <label className={FIELD}>
        <span className={LABEL}>{param.label}</span>
        <input
          type="number"
          inputMode="numeric"
          step={1}
          min={param.min}
          max={param.max}
          className={INPUT}
          value={value === null || value === undefined ? '' : String(value)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
        {range && <span className={HINT}>{range}</span>}
      </label>
    )
  }

  return (
    <label className={`${FIELD} @sm:col-span-2`}>
      <span className={LABEL}>{param.label}</span>
      <input
        className={INPUT}
        value={typeof value === 'string' ? value : ''}
        maxLength={500}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Optional"
      />
    </label>
  )
}

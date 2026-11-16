import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { WhatsAppMark } from '../ui/BrandIcons'
import { browserCountry, callingCode, composeWhatsapp, phoneCountries, splitWhatsapp } from '../../lib/whatsapp'

const SIZES = {
  /** The sign-up wizards' 48px fields. */
  lg: { box: 'h-12 rounded-[12px] text-[14px]', pad: 'pl-11 pr-4' },
  /** Settings' 40px fields. */
  sm: { box: 'h-10 rounded-field text-[13px]', pad: 'pl-11 pr-3' },
} as const

const BOX =
  'border border-border bg-surface2 font-body text-text outline-none transition-[border-color,box-shadow] duration-200'

interface WhatsAppInputProps {
  /** E.164 (`+66812345678`) or '' — what is stored and sent. */
  value: string
  onChange: (e164: string) => void
  size?: keyof typeof SIZES
}

/**
 * The WhatsApp number: a country picker (its calling code) beside the number
 * as people write it at home. The picker is a real `<select>` laid
 * transparently over a short "🇹🇭 +66" label, so phones open their native
 * list while the closed field stays narrow. Emits the composed E.164 on every
 * change ('' while empty); a number typed with its own `+` / `00` wins over
 * the picker. Typed, never verified — the API normalises again and decides.
 */
export default function WhatsAppInput({ value, onChange, size = 'lg' }: WhatsAppInputProps) {
  const countries = useMemo(() => phoneCountries(), [])
  const [iso, setIso] = useState(() => (value ? splitWhatsapp(value, browserCountry()).iso : browserCountry()))
  const [national, setNational] = useState(() => (value ? splitWhatsapp(value, browserCountry()).national : ''))
  // What this field last emitted: a value arriving from outside (Settings
  // seeding the stored number) is re-split; our own echo is not, or typing
  // "0812" would lose its 0 on the way round.
  const emitted = useRef(value)

  useEffect(() => {
    if (value === emitted.current) return
    emitted.current = value
    const split = splitWhatsapp(value, iso || browserCountry())
    setIso(value ? split.iso : iso)
    setNational(value ? split.national : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only an outside value re-seeds
  }, [value])

  const emit = (nextIso: string, nextNational: string) => {
    const composed = composeWhatsapp(nextIso, nextNational)
    emitted.current = composed
    onChange(composed)
  }

  const code = callingCode(iso)
  const current = countries.find((c) => c.iso === iso)
  const s = SIZES[size]

  return (
    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2">
      <label
        className={`${BOX} ${s.box} relative flex min-w-[96px] items-center gap-1.5 px-3 focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--glowAuth)]`}
      >
        <span className="sr-only">Country code</span>
        <span aria-hidden="true" className="whitespace-nowrap">
          {current ? (
            <>
              <span className="mr-1">{current.flag}</span>
              <span className="font-mono font-semibold">+{code}</span>
            </>
          ) : (
            <span className="text-faint">Country</span>
          )}
        </span>
        <ChevronDown size={14} className="ml-auto flex-none text-faint" aria-hidden="true" />
        <select
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          value={iso}
          onChange={(e) => {
            setIso(e.target.value)
            emit(e.target.value, national)
          }}
        >
          <option value="" disabled>
            Choose your country
          </option>
          {countries.map((c) => (
            <option key={c.iso} value={c.iso}>
              {c.name} (+{c.code})
            </option>
          ))}
        </select>
      </label>
      <label className="relative block min-w-0">
        <span className="sr-only">WhatsApp number</span>
        <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[#25D366]">
          <WhatsAppMark size={17} />
        </span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          className={`${BOX} ${s.box} ${s.pad} w-full focus:border-accent focus:shadow-[0_0_0_3px_var(--glowAuth)]`}
          placeholder="WhatsApp number"
          maxLength={32}
          value={national}
          onChange={(e) => {
            setNational(e.target.value)
            emit(iso, e.target.value)
          }}
        />
      </label>
    </div>
  )
}

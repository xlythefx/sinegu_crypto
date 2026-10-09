import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ChevronDown, ImagePlus, X } from 'lucide-react'
import StreakSizingFields from './assets/StreakSizingFields'
import {
  ladderHasErrors,
  ladderShortText,
  rowsFromSteps,
  stepsFromRows,
  type StreakRow,
} from '../../lib/streakSizing'
import type { AdminAsset, AssetInput, AssetSide } from '../../types/admin'
import type { AssetImageChange } from '../../services/admin'

const ASSET_TYPES = ['Cryptocurrency', 'Stocks', 'Forex', 'CFD']
const BROKERS = ['Binance', 'Bybit', 'MEXC']
const MAX_IMAGE_BYTES = 2 * 1024 * 1024 // 2 MB — matches the API rule

/* ---- shared class strings (were the .afm__* rules in AssetFormModal.css) ---- */
const FIELD = 'flex flex-col gap-1.5'
const FIELD_LABEL = 'text-[12px] font-semibold text-muted'
const FIELD_HINT = 'text-[11px] text-faint'
const CONTROL =
  'h-[42px] border border-border rounded-field bg-surface2 px-3 text-[13.5px] text-text outline-none font-body focus:border-accent'
const SELECT = `${CONTROL} [&>option]:bg-surface [&>option]:text-text`
const IMG_BTN =
  'inline-flex items-center gap-[5px] h-8 px-3 border border-border rounded-pill bg-surface2 text-text text-[12px] font-semibold font-body hover:border-accent'
const BTN_BASE =
  'h-10 px-[18px] rounded-pill text-[13px] font-bold font-body disabled:opacity-60 disabled:cursor-not-allowed'

interface AssetFormModalProps {
  open: boolean
  /** null = create mode, otherwise edit this asset. */
  asset: AdminAsset | null
  saving: boolean
  error: string | null
  onSubmit: (input: AssetInput, image: AssetImageChange) => void
  onCancel: () => void
}

const EMPTY: AssetInput = {
  ticker: '',
  type: 'Cryptocurrency',
  broker: 'Binance',
  side: 'ALL',
  max_increments: 1,
  base_size: 0.001,
  enabled: true,
}

/** Create / edit form for a trading asset (admin side). */
export default function AssetFormModal({
  open,
  asset,
  saving,
  error,
  onSubmit,
  onCancel,
}: AssetFormModalProps) {
  const [form, setForm] = useState<AssetInput>(EMPTY)
  const [maxIncrements, setMaxIncrements] = useState('1')
  const [baseSize, setBaseSize] = useState('0.001')

  // Streak sizing. This form always sends the switch and the ladder, so it
  // owns them: what is shown here is exactly what gets saved (rows with no
  // size are not steps, and are left out).
  const [streakEnabled, setStreakEnabled] = useState(false)
  const [streakRows, setStreakRows] = useState<StreakRow[]>([])
  const [streakOpen, setStreakOpen] = useState(false)
  const [streakError, setStreakError] = useState<string | null>(null)

  // Image state: the currently-shown preview URL, a newly picked File (to
  // upload), and a "remove existing" flag. `existingImage` is the saved URL.
  const [existingImage, setExistingImage] = useState<string | null>(null)
  const [pickedFile, setPickedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    if (asset) {
      setForm({
        ticker: asset.ticker,
        type: asset.type,
        broker: asset.broker,
        side: asset.side,
        max_increments: asset.max_increments,
        base_size: asset.base_size,
        enabled: asset.enabled,
      })
      setMaxIncrements(String(asset.max_increments))
      setBaseSize(String(asset.base_size))
      setExistingImage(asset.asset_image)
      setStreakEnabled(asset.streak_sizing_enabled)
      setStreakRows(rowsFromSteps(asset.streak_sizes))
      // Collapsed unless it is already doing something to this asset's sizes.
      setStreakOpen(asset.streak_sizing_enabled)
    } else {
      setForm(EMPTY)
      setMaxIncrements('1')
      setBaseSize('0.001')
      setExistingImage(null)
      setStreakEnabled(false)
      setStreakRows([])
      setStreakOpen(false)
    }
    setStreakError(null)
    // Reset transient image picks whenever the modal (re)opens
    setPickedFile(null)
    setPreviewUrl(null)
    setRemoveImage(false)
    setImageError(null)
  }, [open, asset])

  // Revoke object URLs so we don't leak blobs.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  const shownImage = previewUrl ?? (removeImage ? null : existingImage)
  const fallbackLetter = (form.ticker.trim()[0] ?? '?').toUpperCase()

  const onPickFile = (file: File | undefined) => {
    setImageError(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setImageError('Please choose an image file.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('Image must be 2 MB or smaller.')
      return
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPickedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setRemoveImage(false)
  }

  const clearImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPickedFile(null)
    setPreviewUrl(null)
    // Only flag removal when there's a saved image to delete server-side.
    setRemoveImage(Boolean(existingImage))
    setImageError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Entries that fit in the max position size — what the engine will actually
  // enforce. null when it cannot be derived yet (no/invalid base size).
  const stackDepth = (() => {
    const max = Number(maxIncrements)
    const base = Number(baseSize)
    if (!Number.isFinite(max) || !Number.isFinite(base) || max <= 0 || base <= 0) return null
    return Math.max(1, Math.round(max / base))
  })()

  const streakSteps = stepsFromRows(streakRows)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (ladderHasErrors(streakRows)) {
      setStreakOpen(true)
      setStreakError('Fix the streak steps marked in red before saving.')
      return
    }
    setStreakError(null)
    onSubmit(
      {
        ...form,
        ticker: form.ticker.trim().toUpperCase(),
        max_increments: Number(maxIncrements),
        base_size: Number(baseSize),
        streak_sizing_enabled: streakEnabled,
        streak_sizes: streakSteps,
      },
      { file: pickedFile, remove: removeImage },
    )
  }

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center p-5 bg-black/55"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={asset ? 'Edit asset' : 'Create asset'}
    >
      <form
        className="w-full max-w-[480px] max-h-[90vh] overflow-y-auto bg-surface border border-border rounded-[18px] p-5 sm:p-[26px] flex flex-col gap-3.5"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h3 className="font-display text-[20px] font-extrabold">
          {asset ? `Edit ${asset.ticker}` : 'Create New Asset'}
        </h3>
        <p className="text-[13px] text-muted -mt-2">
          {asset
            ? 'Update the configuration for this asset.'
            : 'Add a new trading asset to the system.'}
        </p>

        <div className="flex items-center gap-3.5">
          <div
            className="w-14 h-14 flex-none rounded-full overflow-hidden border border-border bg-accent-soft grid place-items-center"
            aria-hidden="true"
          >
            {shownImage ? (
              <img src={shownImage} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="font-mono text-[22px] font-bold text-accent">
                {fallbackLetter}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-[12px] font-semibold text-muted">
              Ticker image
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className={IMG_BTN}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus size={14} />
                {shownImage ? 'Change' : 'Upload'}
              </button>
              {shownImage && (
                <button
                  type="button"
                  className={`${IMG_BTN} text-[#ef4444] hover:border-[rgba(239,68,68,0.5)]`}
                  onClick={clearImage}
                >
                  <X size={14} />
                  Remove
                </button>
              )}
            </div>
            <small className="text-[11px] text-faint">
              PNG, JPG, GIF, WEBP or SVG · up to 2 MB. Falls back to a lettered circle.
            </small>
            {imageError && (
              <small className="text-[11px] text-[#ef4444]" role="alert">
                {imageError}
              </small>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0])}
          />
        </div>

        <label className={FIELD}>
          <span className={FIELD_LABEL}>Ticker symbol *</span>
          <input
            type="text"
            className={CONTROL}
            value={form.ticker}
            onChange={(e) =>
              setForm({ ...form, ticker: e.target.value.toUpperCase() })
            }
            placeholder="e.g. BTCUSDT"
            maxLength={20}
            required
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className={FIELD}>
            <span className={FIELD_LABEL}>Type</span>
            <select
              className={SELECT}
              value={form.type ?? ''}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value || null })
              }
            >
              <option value="">None</option>
              {ASSET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className={FIELD}>
            <span className={FIELD_LABEL}>Broker</span>
            <select
              className={SELECT}
              value={form.broker ?? ''}
              onChange={(e) =>
                setForm({ ...form, broker: e.target.value || null })
              }
            >
              <option value="">None</option>
              {BROKERS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className={FIELD}>
          <span className={FIELD_LABEL}>Side</span>
          <select
            className={SELECT}
            value={form.side}
            onChange={(e) =>
              setForm({ ...form, side: e.target.value as AssetSide })
            }
          >
            <option value="ALL">All (long &amp; short)</option>
            <option value="LONG">Long only</option>
            <option value="SHORT">Short only</option>
          </select>
          <small className={FIELD_HINT}>
            Which trade directions this asset is allowed to take
          </small>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className={FIELD}>
            <span className={FIELD_LABEL}>Max position size *</span>
            <input
              type="number"
              className={CONTROL}
              value={maxIncrements}
              onChange={(e) => setMaxIncrements(e.target.value)}
              min="0.001"
              step="0.001"
              required
            />
            {/*
              This field is a SIZE, and the engine turns it into a stack depth
              (size / base size). Showing that depth live is the whole point:
              typing "3" here means three CONTRACTS, not three entries, and the
              difference is invisible until a position stacks further than it
              should. Mirrors the same derivation in AssetCard and assets_api.
            */}
            <span className="mt-1 font-mono text-[11px] text-muted">
              {stackDepth === null
                ? 'set a base size to see the stack depth'
                : `= ${stackDepth} entr${stackDepth === 1 ? 'y' : 'ies'} max per position`}
            </span>
          </label>
          <label className={FIELD}>
            <span className={FIELD_LABEL}>Base size *</span>
            <input
              type="number"
              className={CONTROL}
              value={baseSize}
              onChange={(e) => setBaseSize(e.target.value)}
              min="0.000001"
              step="0.000001"
              required
            />
            <span className="mt-1 font-mono text-[11px] text-muted">
              one entry, per 1,000 USDT of balance
            </span>
          </label>
        </div>

        <label className="flex items-center gap-3 border border-border rounded-[12px] py-3 px-3.5 cursor-pointer">
          <input
            type="checkbox"
            className="w-[18px] h-[18px] accent-[var(--accent)] cursor-pointer"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          />
          <div>
            <span className="text-[13.5px] font-semibold block">Enabled</span>
            <small className="text-[11.5px] text-faint">
              Allow this asset to be used for trading
            </small>
          </div>
        </label>

        {/* Streak Sizing Settings — collapsed unless already on for this asset. */}
        <div className="rounded-[12px] border border-border">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-[12px] py-3 px-3.5 text-left"
            onClick={() => setStreakOpen((o) => !o)}
            aria-expanded={streakOpen}
            aria-controls="afm-streak-sizing"
          >
            <div className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold">Streak Sizing Settings</span>
              <small className="block truncate text-[11.5px] text-faint">
                {!streakEnabled
                  ? 'Off: every entry uses Base size'
                  : streakSteps.length === 0
                    ? 'On, but no steps yet'
                    : `On · ${ladderShortText(streakSteps)}`}
              </small>
            </div>
            <ChevronDown
              size={16}
              className={`flex-none text-muted transition-transform duration-150 ${
                streakOpen ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>

          {streakOpen && (
            <div
              id="afm-streak-sizing"
              className="flex flex-col gap-3.5 border-t border-hair p-3.5"
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-[18px] w-[18px] flex-none cursor-pointer accent-[var(--accent)]"
                  checked={streakEnabled}
                  onChange={(e) => setStreakEnabled(e.target.checked)}
                />
                <div>
                  <span className="block text-[13.5px] font-semibold">
                    Use streak sizing
                  </span>
                  <small className="text-[11.5px] leading-[1.5] text-faint">
                    After losing (or winning) trades in a row on this coin, the
                    next entry uses the size set for that step; otherwise Base
                    size. Max position size still caps the stack. Exits are
                    never affected.
                  </small>
                </div>
              </label>

              <StreakSizingFields
                ticker={form.ticker}
                base={Number(baseSize)}
                rows={streakRows}
                onChange={(next) => {
                  setStreakRows(next)
                  setStreakError(null)
                }}
                baseNote="Base size, set above"
                muted={!streakEnabled}
              />

              {streakError && (
                <p className="text-[12px] text-red" role="alert">
                  {streakError}
                </p>
              )}
            </div>
          )}
        </div>

        {error && (
          <p
            className="py-2.5 px-3.5 border border-[rgba(239,68,68,0.35)] rounded-field bg-[rgba(239,68,68,0.08)] text-[#ef4444] text-[13px]"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2.5 mt-1">
          <button
            type="button"
            className={`${BTN_BASE} border border-border bg-surface2 text-text`}
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`${BTN_BASE} border-0 bg-accent text-on-accent`}
            disabled={saving}
          >
            {saving ? 'Saving…' : asset ? 'Save Changes' : 'Create Asset'}
          </button>
        </div>
      </form>
    </div>
  )
}

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ImagePlus, X } from 'lucide-react'
import type { AdminAsset, AssetInput, AssetSide } from '../../types/admin'
import type { AssetImageChange } from '../../services/admin'
import './AssetFormModal.css'

const ASSET_TYPES = ['Cryptocurrency', 'Stocks', 'Forex', 'CFD']
const BROKERS = ['Binance', 'Bybit', 'MEXC']
const MAX_IMAGE_BYTES = 2 * 1024 * 1024 // 2 MB — matches the API rule

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
    } else {
      setForm(EMPTY)
      setMaxIncrements('1')
      setBaseSize('0.001')
      setExistingImage(null)
    }
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

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(
      {
        ...form,
        ticker: form.ticker.trim().toUpperCase(),
        max_increments: Number(maxIncrements),
        base_size: Number(baseSize),
      },
      { file: pickedFile, remove: removeImage },
    )
  }

  return (
    <div
      className="afm__overlay"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={asset ? 'Edit asset' : 'Create asset'}
    >
      <form
        className="afm"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h3 className="afm__title">
          {asset ? `Edit ${asset.ticker}` : 'Create New Asset'}
        </h3>
        <p className="afm__sub">
          {asset
            ? 'Update the configuration for this asset.'
            : 'Add a new trading asset to the system.'}
        </p>

        <div className="afm__image-row">
          <div className="afm__image-preview" aria-hidden="true">
            {shownImage ? (
              <img src={shownImage} alt="" />
            ) : (
              <span className="afm__image-fallback">{fallbackLetter}</span>
            )}
          </div>
          <div className="afm__image-controls">
            <span className="afm__image-label">Ticker image</span>
            <div className="afm__image-btns">
              <button
                type="button"
                className="afm__image-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus size={14} />
                {shownImage ? 'Change' : 'Upload'}
              </button>
              {shownImage && (
                <button
                  type="button"
                  className="afm__image-btn afm__image-btn--remove"
                  onClick={clearImage}
                >
                  <X size={14} />
                  Remove
                </button>
              )}
            </div>
            <small>PNG, JPG, GIF, WEBP or SVG · up to 2 MB. Falls back to a lettered circle.</small>
            {imageError && (
              <small className="afm__image-error" role="alert">
                {imageError}
              </small>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            className="afm__image-input"
            onChange={(e) => onPickFile(e.target.files?.[0])}
          />
        </div>

        <label className="afm__field">
          <span>Ticker symbol *</span>
          <input
            type="text"
            value={form.ticker}
            onChange={(e) =>
              setForm({ ...form, ticker: e.target.value.toUpperCase() })
            }
            placeholder="e.g. BTCUSDT"
            maxLength={20}
            required
          />
        </label>

        <div className="afm__row">
          <label className="afm__field">
            <span>Type</span>
            <select
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
          <label className="afm__field">
            <span>Broker</span>
            <select
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

        <label className="afm__field">
          <span>Side</span>
          <select
            value={form.side}
            onChange={(e) =>
              setForm({ ...form, side: e.target.value as AssetSide })
            }
          >
            <option value="ALL">All (long &amp; short)</option>
            <option value="LONG">Long only</option>
            <option value="SHORT">Short only</option>
          </select>
          <small>Which trade directions this asset is allowed to take</small>
        </label>

        <div className="afm__row">
          <label className="afm__field">
            <span>Max position size *</span>
            <input
              type="number"
              value={maxIncrements}
              onChange={(e) => setMaxIncrements(e.target.value)}
              min="0.001"
              step="0.001"
              required
            />
          </label>
          <label className="afm__field">
            <span>Base size *</span>
            <input
              type="number"
              value={baseSize}
              onChange={(e) => setBaseSize(e.target.value)}
              min="0.000001"
              step="0.000001"
              required
            />
          </label>
        </div>

        <label className="afm__toggle">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          />
          <div>
            <span>Enabled</span>
            <small>Allow this asset to be used for trading</small>
          </div>
        </label>

        {error && (
          <p className="afm__error" role="alert">
            {error}
          </p>
        )}

        <div className="afm__actions">
          <button
            type="button"
            className="afm__cancel"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="submit" className="afm__save" disabled={saving}>
            {saving ? 'Saving…' : asset ? 'Save Changes' : 'Create Asset'}
          </button>
        </div>
      </form>
    </div>
  )
}

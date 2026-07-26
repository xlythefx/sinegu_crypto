import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Image as ImageIcon, Upload } from 'lucide-react'

export type EditImageType = 'banner' | 'profile'

interface EditImageDialogProps {
  open: boolean
  type: EditImageType
  /** True while the parent is uploading — disables inputs, relabels Apply. */
  busy?: boolean
  /** Upload error surfaced from the parent. */
  error?: string | null
  onCancel: () => void
  onApply: (file: File) => void
}

/** Pick + preview a banner/profile image, then hand the File to the parent to
 *  upload (POST /user/image). */
export default function EditImageDialog({
  open,
  type,
  busy = false,
  error = null,
  onCancel,
  onApply,
}: EditImageDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => {
    if (!open) return
    setPreview(null)
    setFile(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  const label = type === 'banner' ? 'banner' : 'profile'

  const handleFile = (f: File) => {
    setFile(f)
    const reader = new FileReader()
    reader.onloadend = () => setPreview(reader.result as string)
    reader.readAsDataURL(f)
  }

  // Portal to <body> so the overlay covers the whole page — otherwise the
  // card's AOS transform becomes the containing block and traps position:fixed.
  return createPortal(
    <div
      className="sid__overlay"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${label} image`}
    >
      <div className="sid" onClick={(e) => e.stopPropagation()}>
        <h3 className="sid__title">
          Edit {type === 'banner' ? 'Banner' : 'Profile'} Image
        </h3>
        <p className="sid__sub">
          Upload a new {label} image. It is previewed locally for now.
        </p>

        <div className="sid__drop">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            className="sid__file"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
          {preview ? (
            <>
              <img
                src={preview}
                alt="Preview"
                className={`sid__preview sid__preview--${type}`}
              />
              <button
                type="button"
                className="sbtn sbtn--ghost"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon size={14} />
                Change Image
              </button>
            </>
          ) : (
            <>
              <ImageIcon size={40} className="sid__drop-icon" />
              <p className="sid__drop-hint">
                {type === 'banner'
                  ? 'Recommended: 1920x1080px or larger'
                  : 'Recommended: 400x400px or larger'}
              </p>
              <button
                type="button"
                className="sbtn sbtn--ghost"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} />
                Select Image
              </button>
            </>
          )}
        </div>

        {error && (
          <p className="sid__error" role="alert">
            {error}
          </p>
        )}

        <div className="sid__actions">
          <button
            type="button"
            className="sbtn sbtn--ghost"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="sbtn sbtn--primary"
            disabled={!file || busy}
            onClick={() => file && onApply(file)}
          >
            {busy ? 'Uploading…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

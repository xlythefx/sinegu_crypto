import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Image as ImageIcon, Upload } from 'lucide-react'
import { BTN_GHOST, BTN_PRIMARY } from './formClasses'

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
      className="fixed inset-0 bg-[rgba(0,0,0,0.55)] backdrop-blur-[3px] flex items-center justify-center z-[1000] animate-[fadeup_0.2s_ease_both]"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${label} image`}
    >
      <div
        className="w-[calc(100%-48px)] max-w-[480px] p-[26px] border border-border rounded-[20px] bg-surface shadow-[0_30px_80px_rgba(0,0,0,0.35)] animate-[fadeup_0.25s_cubic-bezier(0.2,0.7,0.2,1)_both]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-[19px] font-extrabold tracking-[-0.02em]">
          Edit {type === 'banner' ? 'Banner' : 'Profile'} Image
        </h3>
        <p className="text-[13px] text-muted mt-1 mb-[18px]">
          Upload a new {label} image. It is previewed locally for now.
        </p>

        <div className="flex flex-col items-center gap-3 py-[26px] px-[18px] border-2 border-dashed border-border rounded-[14px] text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            className="hidden"
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
                className={
                  type === 'banner'
                    ? 'rounded-field w-full h-[120px] object-cover'
                    : 'rounded-full w-[120px] h-[120px] object-cover'
                }
              />
              <button
                type="button"
                className={BTN_GHOST}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon size={14} />
                Change Image
              </button>
            </>
          ) : (
            <>
              <ImageIcon size={40} className="text-faint" />
              <p className="text-[12.5px] text-muted">
                {type === 'banner'
                  ? 'Recommended: 1920x1080px or larger'
                  : 'Recommended: 400x400px or larger'}
              </p>
              <button
                type="button"
                className={BTN_GHOST}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} />
                Select Image
              </button>
            </>
          )}
        </div>

        {error && (
          <p
            className="mt-3.5 py-2.5 px-3.5 border border-[rgba(239,68,68,0.35)] rounded-field bg-[rgba(239,68,68,0.08)] text-[#ef4444] text-[13px]"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2.5 mt-[18px]">
          <button
            type="button"
            className={BTN_GHOST}
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={BTN_PRIMARY}
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

import { useEffect, useState } from 'react'
import { BTN_GHOST, BTN_PRIMARY, FIELD, INPUT, LABEL, SELECT } from '../../../settings/formClasses'
import { newTemplateFields, TEMPLATE_SECONDS, TEMPLATES, templateMeta } from '../../../../lib/creativeVideos'
import type { TemplateFields, TemplateKey, VideoAspect } from '../../../../types/creativeVideos'
import CreativeModal from '../CreativeModal'
import TemplateCanvas from './TemplateCanvas'

/** The boxes of one card (title / figure / subtitle, as its template uses them). */
export function TemplateFieldsForm({ fields, onChange }: { fields: TemplateFields; onChange: (f: TemplateFields) => void }) {
  const meta = templateMeta(fields.key)
  return (
    <div className="flex flex-col gap-3.5">
      {meta.fields.map((f) => (
        <label key={f.name} className={FIELD}>
          <span className={LABEL}>{f.label}</span>
          <input
            className={INPUT}
            value={fields[f.name]}
            maxLength={f.name === 'title' && fields.key === 'disclaimer' ? 200 : 60}
            placeholder={f.placeholder}
            onChange={(e) => onChange({ ...fields, [f.name]: e.target.value })}
          />
        </label>
      ))}
    </div>
  )
}

interface TemplateEditorProps {
  open: boolean
  aspect: VideoAspect
  /** Start from this card (editing); null = a new one. */
  initial: TemplateFields | null
  /** Offer a family first (the style's). */
  family?: 'pixel' | 'clean'
  busy: boolean
  onClose: () => void
  /** New card: with its length. Editing: seconds is ignored. */
  onSave: (fields: TemplateFields, seconds: number) => void
}

/**
 * Add (or edit) a free template card — title, HIGH SCORE board, LEVEL UP,
 * stat or disclaimer. Drawn in the browser, so it costs nothing; the live
 * preview is the export's own drawing. Numbers belong here, typed exactly,
 * rather than inside a generated clip.
 */
export default function TemplateEditor({ open, aspect, initial, family = 'clean', busy, onClose, onSave }: TemplateEditorProps) {
  const first = TEMPLATES.find((t) => t.family === family)?.key ?? 'clean-title'
  const [fields, setFields] = useState<TemplateFields>(initial ?? newTemplateFields(first))
  const [seconds, setSeconds] = useState(3)

  useEffect(() => {
    if (!open) return
    setFields(initial ?? newTemplateFields(first))
    setSeconds(3)
  }, [open, initial, first])

  const pick = (key: TemplateKey) => setFields((f) => ({ ...newTemplateFields(key), ...(f.key === key ? f : {}) }))
  const tall = aspect === '9:16'

  return (
    <CreativeModal
      open={open}
      title={initial ? 'Edit the card' : 'Add a template card'}
      subtitle="Free — drawn in the browser, no Higgsfield. Use cards for exact figures, titles and the disclaimer."
      onClose={onClose}
      maxWidth={760}
    >
      <div className={`grid gap-5 ${tall ? 'sm:grid-cols-[minmax(0,1fr)_200px]' : ''}`}>
        <div className="flex min-w-0 flex-col gap-4">
          <label className={FIELD}>
            <span className={LABEL}>Card</span>
            <select className={SELECT} value={fields.key} onChange={(e) => pick(e.target.value as TemplateKey)}>
              <optgroup label="Pixel (8-bit)">
                {TEMPLATES.filter((t) => t.family === 'pixel').map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Clean">
                {TEMPLATES.filter((t) => t.family === 'clean').map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
            </select>
            <span className="text-[11.5px] text-faint">{templateMeta(fields.key).hint}</span>
          </label>
          <TemplateFieldsForm fields={fields} onChange={setFields} />
          {!initial && (
            <label className={FIELD}>
              <span className={LABEL}>Length</span>
              <select className={SELECT} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))}>
                {TEMPLATE_SECONDS.map((s) => (
                  <option key={s} value={s}>
                    {s} seconds
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div
          className="mx-auto w-full overflow-hidden rounded-[12px] border border-border bg-black"
          style={{ aspectRatio: aspect.replace(':', ' / '), maxWidth: tall ? 200 : 560 }}
        >
          <TemplateCanvas fields={fields} aspect={aspect} animate />
        </div>
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2.5 border-t border-hair pt-4 sm:flex-row sm:justify-end">
        <button type="button" className={BTN_GHOST} onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className={BTN_PRIMARY} onClick={() => onSave(fields, seconds)} disabled={busy}>
          {busy ? 'Saving…' : initial ? 'Use these words' : `Add the card · ${seconds} s · free`}
        </button>
      </div>
    </CreativeModal>
  )
}

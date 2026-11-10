import { useRef, useState, type ChangeEvent } from 'react'
import { CircleAlert, CircleCheck, ImageOff, Images, Trash2, Upload } from 'lucide-react'
import ConfirmModal from '../../../ui/ConfirmModal'
import { BTN_PRIMARY, FIELD, INPUT, LABEL } from '../../../settings/formClasses'
import { fmtDateTime } from '../../../../lib/format'
import { creativeErrorMessage, signedUrl } from '../../../../lib/creatives'
import { deleteCharacterRef, uploadCharacterRef } from '../../../../services/creatives'
import type { CreativeCharacter, CreativeCharacterRef } from '../../../../types/creatives'
import SectionHeader from '../SectionHeader'
import TonePill from '../TonePill'
import { NOTICE, SECTION } from '../creativeClasses'

interface CharacterRefsProps {
  character: CreativeCharacter
  maxReferences: number
  onChanged: (character: CreativeCharacter) => void
  delay?: number
}

const ACCEPT = ['image/png', 'image/jpeg', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

function fmtSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function RefTile({ refImage, onDelete, busy }: { refImage: CreativeCharacterRef; onDelete: () => void; busy: boolean }) {
  const [broken, setBroken] = useState(false)
  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-row border border-border bg-surface2">
      <div className="grid aspect-square w-full place-items-center bg-surface">
        {broken ? (
          <span className="flex flex-col items-center gap-1.5 px-3 text-center text-[11.5px] text-muted">
            <ImageOff size={18} aria-hidden="true" className="text-faint" />
            Reload the page to see it.
          </span>
        ) : (
          <img
            src={signedUrl(refImage.image_path)}
            alt={refImage.label ?? `Reference image #${refImage.id}`}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setBroken(true)}
          />
        )}
      </div>
      <div className="flex min-w-0 items-start gap-2 p-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-bold text-text" title={refImage.label ?? undefined}>
            {refImage.label ?? 'No label'}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <TonePill tone={refImage.source === 'generation' ? 'accent' : 'muted'}>
              {refImage.source === 'generation' ? 'From the Gallery' : 'Uploaded'}
            </TonePill>
            <span className="font-mono text-[10.5px] text-faint">{fmtSize(refImage.bytes)}</span>
          </div>
          <p className="mt-1 text-[11px] text-faint">{fmtDateTime(refImage.created_at)}</p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          aria-label={`Delete ${refImage.label ?? `reference image #${refImage.id}`}`}
          className="-mr-1 inline-flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-btn text-muted transition-[background,color] duration-150 hover:bg-[color-mix(in_srgb,var(--red)_10%,transparent)] hover:text-red disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
    </li>
  )
}

/**
 * The character's stored reference images — the ONLY files kept on our
 * server. They are sent with every character image and video so it always
 * looks the same. Upload (png / jpg / webp, ≤ 5 MB) or keep a Studio result;
 * deleting one is confirmed.
 */
export default function CharacterRefs({ character, maxReferences, onChanged, delay }: CharacterRefsProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<CreativeCharacterRef | null>(null)

  const count = character.refs.length
  const full = count >= maxReferences

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // the same file can be picked again after a refusal
    if (!file) return
    setDone(null)
    if (!ACCEPT.includes(file.type)) {
      setError('That file is not a PNG, JPG or WebP picture.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError(`That picture is ${fmtSize(file.size)} — the most is 5 MB.`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const next = await uploadCharacterRef(file, label)
      onChanged(next)
      setLabel('')
      setDone(`Added. ${character.name} now has ${next.refs.length} of ${maxReferences} reference images.`)
    } catch (err) {
      setError(creativeErrorMessage(err, 'Could not upload the picture.'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    const target = deleting
    setDeleting(null)
    if (!target) return
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      onChanged(await deleteCharacterRef(target.id))
    } catch (err) {
      setError(creativeErrorMessage(err, 'Could not delete the picture.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={`${SECTION} @container`} data-aos="fade-up" data-aos-delay={delay} aria-labelledby="creatives-refs">
      <SectionHeader
        icon={Images}
        id="creatives-refs"
        title="Reference images"
        subtitle={`${count} of ${maxReferences}. Sent with every character image and video, so ${character.name} always looks the same.`}
      />

      <div className="grid grid-cols-1 gap-3 @md:grid-cols-[minmax(0,1fr)_auto] @md:items-end">
        <label className={FIELD}>
          <span className={LABEL}>Label for the next picture (optional)</span>
          <input
            className={INPUT}
            value={label}
            maxLength={80}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Front view, waving"
            disabled={busy || full}
          />
        </label>
        <button
          type="button"
          className={BTN_PRIMARY}
          onClick={() => fileRef.current?.click()}
          disabled={busy || full}
        >
          <Upload size={15} aria-hidden="true" />
          {busy ? 'Working…' : 'Upload picture'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT.join(',')}
          className="hidden"
          onChange={(e) => void onFile(e)}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
      <p className="-mt-1 text-[11.5px] text-faint">
        PNG, JPG or WebP, up to 5 MB.
        {full && ` ${character.name} has the most allowed — delete one to add another.`}
      </p>

      {error && (
        <p className={NOTICE.error} role="alert">
          <CircleAlert size={15} aria-hidden="true" />
          {error}
        </p>
      )}
      {done && (
        <p className={NOTICE.success} role="status">
          <CircleCheck size={15} aria-hidden="true" />
          {done}
        </p>
      )}

      {count === 0 ? (
        <p className="rounded-row border border-dashed border-border px-4 py-8 text-center text-[13px] leading-[1.6] text-muted">
          No reference images yet. Upload one, or make candidates in the Gallery and keep the best with “Use as
          character reference”.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 @sm:grid-cols-3 @2xl:grid-cols-4">
          {character.refs.map((r) => (
            <RefTile key={r.id} refImage={r} busy={busy} onDelete={() => setDeleting(r)} />
          ))}
        </ul>
      )}

      <ConfirmModal
        open={deleting !== null}
        title="Delete this reference image?"
        message={`${character.name}’s images and videos made from now on will no longer use it. Results already made stay as they are. This cannot be undone.`}
        confirmLabel="Delete picture"
        cancelLabel="Keep it"
        danger
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(null)}
      />
    </section>
  )
}

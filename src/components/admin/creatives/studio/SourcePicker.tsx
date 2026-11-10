import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { FILTER_LABEL } from '../../../ui/filters'
import { HINT } from '../../../settings/formClasses'
import { isExpiredGeneration, signedUrl } from '../../../../lib/creatives'
import type { CreativeCharacterRef, CreativeGeneration, CreativeSource } from '../../../../types/creatives'

interface SourcePickerProps {
  /** The gallery's rows; only finished, still-kept images are offered. */
  generations: CreativeGeneration[]
  refs: CreativeCharacterRef[]
  characterName: string
  value: CreativeSource | null
  onChange: (source: CreativeSource) => void
  now: number
  disabled?: boolean
}

/** How many recent outputs to offer before the list gets long on a phone. */
const RECENT_LIMIT = 12

function sameSource(a: CreativeSource | null, b: CreativeSource): boolean {
  if (!a) return false
  if ('ref_id' in a && 'ref_id' in b) return a.ref_id === b.ref_id
  if ('generation_id' in a && 'generation_id' in b) return a.generation_id === b.generation_id && a.index === b.index
  return false
}

function Thumb({
  src,
  label,
  on,
  disabled,
  onClick,
}: {
  src: string
  label: string
  on: boolean
  disabled?: boolean
  onClick: () => void
}) {
  const [broken, setBroken] = useState(false)
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative aspect-square w-full cursor-pointer overflow-hidden rounded-[10px] border-2 bg-surface2 transition-[border-color,opacity] duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
        on ? 'border-accent shadow-[0_0_0_3px_var(--glow)]' : 'border-transparent hover:border-accent-line'
      }`}
    >
      {broken ? (
        <span className="grid h-full w-full place-items-center text-faint">
          <ImageOff size={16} aria-hidden="true" />
        </span>
      ) : (
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      )}
    </button>
  )
}

/**
 * The picture "Animate an image" moves: one of the recent finished images, or
 * one of the character's stored reference images. The video takes the
 * picture's shape, so a still made in 9:16 becomes a TikTok-shaped video.
 */
export default function SourcePicker({
  generations,
  refs,
  characterName,
  value,
  onChange,
  now,
  disabled,
}: SourcePickerProps) {
  const outputs = generations
    .filter((g) => g.kind === 'image' && g.status === 'completed' && !isExpiredGeneration(g, now))
    .flatMap((g) =>
      g.outputs
        .map((o, index) => ({ g, o, index }))
        .filter(({ o }) => o.type === 'image'),
    )
  const picked = outputs.filter(({ g, index }) => sameSource(value, { generation_id: g.id, index }))
  const recent = outputs.slice(0, RECENT_LIMIT)
  const shown = [...recent, ...picked.filter((p) => !recent.includes(p))]

  return (
    <div className="flex flex-col gap-3 rounded-row border border-border bg-surface2 p-3.5">
      <div>
        <p className="text-[13px] font-bold text-text">Picture to animate</p>
        <p className={`${HINT} mt-0.5 leading-[1.5]`}>
          The video keeps the picture’s shape — make the still in 9:16 for TikTok, 16:9 for X.
        </p>
      </div>

      <div role="radiogroup" aria-label="Recent images" className="flex flex-col gap-2">
        <span className={FILTER_LABEL}>Recent images</span>
        {shown.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-border px-3 py-4 text-center text-[12px] text-muted">
            No finished images yet. Make one with an image model first, then animate it.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2 @md:grid-cols-6">
            {shown.map(({ g, o, index }) => (
              <Thumb
                key={`${g.id}-${index}`}
                src={o.url}
                label={`Image #${g.id}${g.outputs.length > 1 ? `, picture ${index + 1}` : ''}`}
                on={sameSource(value, { generation_id: g.id, index })}
                disabled={disabled}
                onClick={() => onChange({ generation_id: g.id, index })}
              />
            ))}
          </div>
        )}
      </div>

      <div role="radiogroup" aria-label={`${characterName}’s reference images`} className="flex flex-col gap-2">
        <span className={FILTER_LABEL}>{characterName}’s reference images</span>
        {refs.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-border px-3 py-4 text-center text-[12px] text-muted">
            No reference images yet — add them in the Pixel panel.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2 @md:grid-cols-6">
            {refs.map((ref) => (
              <Thumb
                key={ref.id}
                src={signedUrl(ref.image_path)}
                label={ref.label ?? `Reference image #${ref.id}`}
                on={sameSource(value, { ref_id: ref.id })}
                disabled={disabled}
                onClick={() => onChange({ ref_id: ref.id })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

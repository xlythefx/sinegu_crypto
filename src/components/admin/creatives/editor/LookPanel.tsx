import { Segmented } from '../../../ui/filters'
import { PIXEL_SIZES } from '../../../../lib/creativeVideos'
import type { PixelSize, TimelineDoc } from '../../../../types/creativeVideos'
import ToggleSwitch from '../ToggleSwitch'
import { PANE_TITLE } from './editorClasses'

interface LookPanelProps {
  timeline: TimelineDoc
  onTimeline: (fn: (tl: TimelineDoc) => TimelineDoc) => void
}

/** The Pixel look: pixelate the clips (block size) and lay scanlines over the picture — preview and export alike. */
export default function LookPanel({ timeline, onTimeline }: LookPanelProps) {
  const look = timeline.look
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h3 className={PANE_TITLE}>Pixelate the clips</h3>
        <Segmented
          value={String(look.pixel_size)}
          onChange={(v) => onTimeline((tl) => ({ ...tl, look: { ...tl.look, pixel_size: Number(v) as PixelSize } }))}
          ariaLabel="Pixel size"
          size="sm"
          options={PIXEL_SIZES.map((p) => ({ value: String(p.value), label: p.label }))}
        />
        <p className="text-[12px] leading-[1.55] text-muted">
          Turns the AI clips into 8-bit blocks. Template cards and captions stay sharp so every figure stays readable.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ToggleSwitch
          on={look.scanlines}
          onChange={(v) => onTimeline((tl) => ({ ...tl, look: { ...tl.look, scanlines: v } }))}
          label="Scanlines"
        />
        <div className="min-w-[200px] flex-1">
          <p className="text-[13px] font-bold text-text">Scanlines</p>
          <p className="text-[12px] leading-[1.5] text-muted">Thin dark lines across the picture, like an arcade screen.</p>
        </div>
      </div>
    </div>
  )
}

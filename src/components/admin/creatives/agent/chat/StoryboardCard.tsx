import { Bot, Clapperboard, LayoutTemplate, Lightbulb, Scissors } from 'lucide-react'
import { PLATFORM_LABEL } from '../../../../../lib/creatives'
import { fmtJobUsd } from '../../../../../lib/creativesAgent'
import type { CreativeStoryboard, CreativeStoryboardScene } from '../../../../../types/creatives'
import TonePill from '../../TonePill'
import { FACT_LABEL } from '../../creativeClasses'
import { AGENT_INDENT } from './ChatParts'

interface StoryboardCardProps {
  storyboard: CreativeStoryboard
}

/** "pixel-arcade" → "Pixel arcade" (the agent names a style by its slug). */
function styleName(style: string): string {
  const s = style.trim().replace(/[-_]+/g, ' ')
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

/** "3 s", "2.5 s". */
const secs = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} s`

function EnginePill({ scene }: { scene: CreativeStoryboardScene }) {
  if (scene.kind === 'template' || scene.engine === 'none') {
    return (
      <TonePill tone="muted" icon={LayoutTemplate}>
        {scene.engine_label || 'Template card · free'}
      </TonePill>
    )
  }
  const seedance = scene.engine === 'seedance'
  return (
    <TonePill tone={seedance ? 'teal' : 'silver'} icon={Clapperboard}>
      {scene.engine_label || (seedance ? 'Seedance · with sound' : 'Kling · silent')}
    </TonePill>
  )
}

function SceneRow({ scene }: { scene: CreativeStoryboardScene }) {
  const trimmed = scene.kind === 'clip' && scene.generated_seconds > 0 && scene.generated_seconds !== scene.seconds
  return (
    <li className="flex min-w-0 gap-2.5 px-3 py-2.5">
      <span
        className="mt-px grid h-6 w-6 flex-none place-items-center rounded-full border border-border bg-surface font-mono text-[10.5px] font-semibold text-muted"
        aria-hidden="true"
      >
        {scene.n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="min-w-0 flex-1 break-words text-[13px] font-bold leading-[1.35] text-text">
            <span className="sr-only">Scene {scene.n}: </span>
            {scene.label}
          </span>
          <span className="flex-none font-mono text-[12px] font-semibold tabular-nums text-text">{secs(scene.seconds)}</span>
          <span className="w-[52px] flex-none text-right font-mono text-[11.5px] tabular-nums text-muted">
            {scene.est_usd > 0 ? fmtJobUsd(scene.est_usd) : 'Free'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <EnginePill scene={scene} />
          {scene.kind === 'clip' &&
            (scene.with_pixel ? (
              <TonePill tone="accent" icon={Bot}>
                Pixel
              </TonePill>
            ) : (
              <span className="text-[11px] font-semibold text-faint">No Pixel</span>
            ))}
          {trimmed && (
            <span className="inline-flex items-center gap-1 text-[11px] text-faint">
              <Scissors size={11} aria-hidden="true" />
              made {secs(scene.generated_seconds)} · trimmed to {secs(scene.seconds)}
            </span>
          )}
        </div>
        {scene.shows && <p className="break-words text-[12.5px] leading-[1.5] text-text">{scene.shows}</p>}
        {scene.why && <p className="break-words text-[12px] leading-[1.5] text-muted">{scene.why}</p>}
      </div>
    </li>
  )
}

/**
 * The storyboard the agent shows BEFORE it builds (`show_storyboard`): each
 * scene's length — and when a clip is made longer and trimmed — its engine,
 * Pixel or not, what we see, why, and an estimated price; the whole video's
 * platform, shape, style, length and estimated total on top; the agent's
 * overall insight below. Read-only: the question that follows ("Build it?")
 * carries the buttons, and the job card the exact price.
 */
export default function StoryboardCard({ storyboard: b }: StoryboardCardProps) {
  const style = styleName(b.style)
  const facts = [PLATFORM_LABEL[b.platform] ?? b.platform, b.aspect, style, secs(b.total_seconds)].filter(Boolean)

  return (
    <div className={`${AGENT_INDENT} animate-[fadeup_0.3s_ease-out]`}>
      <article aria-label={`Storyboard: ${b.title}`} className="flex min-w-0 flex-col overflow-hidden rounded-card border border-border bg-surface">
        <header className="flex min-w-0 flex-col gap-1.5 border-b border-hair px-3.5 pb-3 pt-3.5">
          <p className={FACT_LABEL}>
            Storyboard · {b.scenes.length === 1 ? '1 scene' : `${b.scenes.length} scenes`}
            {b.video_id === null ? ' · new video' : ''}
          </p>
          <h3 className="break-words font-display text-[15px] font-extrabold leading-[1.3] tracking-[-0.01em] text-text">{b.title}</h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
            <span>{facts.join(' · ')}</span>
            <span className="ml-auto font-mono text-[12px] font-semibold tabular-nums text-text">
              est. {b.est_total_usd > 0 ? fmtJobUsd(b.est_total_usd) : 'free'}
            </span>
          </div>
        </header>
        <ol className="flex flex-col divide-y divide-hair bg-surface2/50">
          {b.scenes.map((s) => (
            <SceneRow key={s.n} scene={s} />
          ))}
        </ol>
        {b.notes && (
          <p className="flex items-start gap-2 border-t border-hair px-3.5 py-3 text-[12.5px] leading-[1.55] text-text">
            <Lightbulb size={14} aria-hidden="true" className="mt-[2px] flex-none text-accent" />
            <span className="min-w-0 break-words">{b.notes}</span>
          </p>
        )}
        <p className="border-t border-hair px-3.5 py-2 text-[11px] leading-[1.5] text-faint">
          Prices are estimates. Nothing is made or spent until you say build it and press Go on the priced job.
        </p>
      </article>
    </div>
  )
}

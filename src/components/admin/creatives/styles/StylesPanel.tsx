import { useState } from 'react'
import { CircleAlert, Palette, PenLine, Plus } from 'lucide-react'
import DataState from '../../../dashboard/DataState'
import { useCreativeStyles } from '../../../../hooks/useCreativeStyles'
import { videoErrorMessage } from '../../../../lib/creativeVideos'
import type { CreativeStyle } from '../../../../types/creatives'
import SectionHeader from '../SectionHeader'
import ToggleSwitch from '../ToggleSwitch'
import TonePill from '../TonePill'
import { BTN_SOFT, NOTICE, SECTION } from '../creativeClasses'
import StyleModal from './StyleModal'

const PLATFORM: Record<string, string> = { x: 'X', tiktok: 'TikTok', any: 'X or TikTok' }
const PIXEL: Record<string, string> = { none: 'No Pixel', cameo: 'Pixel cameo', lead: 'Pixel leads' }

/**
 * The marketing styles a video can come out in (Data recap, Pixel arcade…).
 * The agent reads each summary to pick one and follows its rules; a new
 * video project takes its defaults. Everyone on the team may add, edit,
 * switch off or delete one (delete asks first).
 */
export default function StylesPanel() {
  const { styles, loading, error, reload, create, update, remove } = useCreativeStyles()
  const [editing, setEditing] = useState<CreativeStyle | null>(null)
  const [creating, setCreating] = useState(false)
  const [toggling, setToggling] = useState<number | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)

  const toggle = async (s: CreativeStyle, enabled: boolean) => {
    setToggling(s.id)
    setToggleError(null)
    try {
      await update(s.id, { enabled })
    } catch (err) {
      setToggleError(videoErrorMessage(err, 'Could not switch the style.'))
    } finally {
      setToggling(null)
    }
  }

  return (
    <section className={SECTION} aria-labelledby="creatives-styles">
      <SectionHeader
        icon={Palette}
        id="creatives-styles"
        title="Marketing styles"
        subtitle="Each style is a look a video can come out in. The agent asks which one you want (or picks from the plan), then follows its rules."
        actions={
          <button type="button" className={BTN_SOFT} onClick={() => setCreating(true)}>
            <Plus size={14} aria-hidden="true" />
            New style
          </button>
        }
      />

      {toggleError && (
        <p className={NOTICE.error} role="alert">
          <CircleAlert size={15} aria-hidden="true" />
          {toggleError}
        </p>
      )}

      {!styles ? (
        <DataState loading={loading} error={error} onRetry={reload} label="styles" />
      ) : styles.length === 0 ? (
        <p className="rounded-row border border-dashed border-border px-4 py-10 text-center text-[13px] leading-[1.6] text-muted">
          No styles yet. Add one so the agent has a look to follow.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {styles.map((s) => (
            <li
              key={s.id}
              className={`flex flex-col gap-3 rounded-row border border-hair bg-surface2/60 p-3.5 sm:p-4 ${s.enabled ? '' : 'opacity-70'}`}
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-[180px] flex-1">
                  <p className="text-[14px] font-bold text-text">{s.name}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-faint">{s.slug}</p>
                </div>
                <ToggleSwitch
                  on={s.enabled}
                  onChange={(v) => void toggle(s, v)}
                  busy={toggling === s.id}
                  label={`${s.name}: offered to the agent`}
                />
              </div>
              {s.summary && <p className="text-[12.5px] leading-[1.55] text-muted">{s.summary}</p>}
              <div className="flex flex-wrap gap-1.5">
                <TonePill tone="muted">{PLATFORM[s.default_platform] ?? s.default_platform}</TonePill>
                <TonePill tone="muted">{s.default_aspect}</TonePill>
                <TonePill tone={s.pixel_default === 'none' ? 'muted' : 'accent'}>{PIXEL[s.pixel_default] ?? s.pixel_default}</TonePill>
                <TonePill tone="teal">{s.default_engine === 'seedance' ? 'Seedance · sound' : 'Kling · silent'}</TonePill>
                {s.music_default !== 'none' && <TonePill tone="silver">Chiptune</TonePill>}
                {s.pixel_look && <TonePill tone="accent">Pixel look</TonePill>}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hair pt-3">
                <span className="text-[11.5px] text-faint">{s.updated_by_name ? `Edited by ${s.updated_by_name}` : 'Starting style'}</span>
                <button type="button" className={BTN_SOFT} onClick={() => setEditing(s)}>
                  <PenLine size={14} aria-hidden="true" />
                  Edit
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <StyleModal
        open={creating}
        style={null}
        onClose={() => setCreating(false)}
        onSave={async (input) => {
          await create(input)
        }}
      />
      <StyleModal
        open={editing !== null}
        style={editing}
        onClose={() => setEditing(null)}
        onSave={async (input) => {
          if (editing) await update(editing.id, input)
        }}
        onDelete={editing ? () => remove(editing.id) : undefined}
      />
    </section>
  )
}

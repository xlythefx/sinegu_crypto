import { useEffect, useRef, useState } from 'react'
import { CircleAlert, Dices, Mic, Music, Play, Plus, Square, Trash2, Upload, Volume2 } from 'lucide-react'
import ConfirmModal from '../../../ui/ConfirmModal'
import { Segmented } from '../../../ui/filters'
import { INPUT, SELECT } from '../../../settings/formClasses'
import { fmtDateTime } from '../../../../lib/format'
import { MUSIC_PRESETS, SFX_SOUNDS, fmtSeconds, localId, videoErrorMessage } from '../../../../lib/creativeVideos'
import { randomSeed, renderTune } from '../../../../lib/videoEditor/chiptune'
import { measureAudioMs } from '../../../../lib/videoEditor/clips'
import { previewSfx } from '../../../../lib/videoEditor/sfx'
import type { CreativeAudioState } from '../../../../hooks/useCreativeAudio'
import type { AudioKind, CreativeAudioAsset, MusicPreset, SfxSound, TimelineDoc } from '../../../../types/creativeVideos'
import ToggleSwitch from '../ToggleSwitch'
import { BTN_SOFT, NOTICE } from '../creativeClasses'
import { ICON_SQ, PANE_TITLE, RANGE, ROW } from './editorClasses'
import SecondsInput from './SecondsInput'

interface AudioPanelProps {
  timeline: TimelineDoc
  totalMs: number
  timeMs: number
  library: CreativeAudioState
  selectedSfx: string | null
  onSelectSfx: (id: string) => void
  onTimeline: (fn: (tl: TimelineDoc) => TimelineDoc) => void
}

const MAX_BYTES = 15 * 1024 * 1024
const ACCEPT = 'audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/aac,audio/webm,audio/ogg,.mp3,.wav,.m4a,.aac,.webm,.ogg'

type MusicMode = 'none' | 'chiptune' | 'asset'

function Slider({ label, value, onChange, min = 0, max = 1, step = 0.05, suffix }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.05em] text-faint">
        {label}
        <span className="font-mono text-[11px] normal-case tracking-normal text-muted">{suffix ?? `${Math.round(value * 100)}%`}</span>
      </span>
      <input type="range" className={RANGE} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

let previewCtx: AudioContext | null = null

/**
 * The video's sound: music (the built-in chiptune — a new tune at a click —
 * or a file from the library), a voiceover (uploaded or recorded here),
 * ducking (the music dips under the voice), the Seedance clips' own sound,
 * and arcade sound effects placed at the playhead. Plus the shared library
 * itself: upload, record, delete (asks first).
 */
export default function AudioPanel({ timeline, totalMs, timeMs, library, selectedSfx, onSelectSfx, onTimeline }: AudioPanelProps) {
  const [hearing, setHearing] = useState(false)
  const tuneSrc = useRef<AudioBufferSourceNode | null>(null)
  const [uploadKind, setUploadKind] = useState<AudioKind>('music')
  const [uploadLabel, setUploadLabel] = useState('')
  const [uploading, setUploading] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const recorder = useRef<MediaRecorder | null>(null)
  const [deleting, setDeleting] = useState<CreativeAudioAsset | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const music = timeline.music
  const mode: MusicMode = music === null ? 'none' : music.source
  const assets = library.audio ?? []
  const musicAssets = assets.filter((a) => a.kind === 'music')
  const voiceAssets = assets.filter((a) => a.kind === 'voiceover')

  const stopTune = () => {
    try {
      tuneSrc.current?.stop()
    } catch {
      // already stopped
    }
    tuneSrc.current = null
    setHearing(false)
  }
  useEffect(() => () => stopTune(), [])
  useEffect(() => () => recorder.current?.stream.getTracks().forEach((t) => t.stop()), [])

  const hearTune = async () => {
    if (hearing) return stopTune()
    if (!music || music.source !== 'chiptune' || typeof AudioContext === 'undefined') return
    previewCtx ??= new AudioContext()
    await previewCtx.resume()
    setHearing(true)
    const buf = await renderTune(music.preset, music.seed, 10_000)
    const src = previewCtx.createBufferSource()
    src.buffer = buf
    const g = previewCtx.createGain()
    g.gain.value = music.volume
    src.connect(g)
    g.connect(previewCtx.destination)
    src.onended = () => setHearing(false)
    src.start()
    tuneSrc.current = src
  }

  const setMode = (m: MusicMode) => {
    stopTune()
    onTimeline((tl) => ({
      ...tl,
      music:
        m === 'none'
          ? null
          : m === 'chiptune'
            ? { source: 'chiptune', preset: 'arcade-upbeat', seed: randomSeed(), volume: 0.6, fade_out_ms: 1500 }
            : musicAssets[0]
              ? { source: 'asset', asset_id: musicAssets[0].id, volume: 0.7, start_ms: 0, fade_out_ms: 1500 }
              : tl.music,
    }))
    if (m === 'asset' && musicAssets.length === 0) setProblem('There is no music in the library yet. Upload a track below first.')
  }

  const patchMusic = (p: Record<string, unknown>) =>
    onTimeline((tl) => (tl.music ? { ...tl, music: { ...tl.music, ...p } as TimelineDoc['music'] } : tl))

  const upload = async (file: Blob, kind: AudioKind, label: string, filename?: string) => {
    if (file.size > MAX_BYTES) {
      setProblem('That file is over 15 MB. Use a shorter or more compressed file.')
      return null
    }
    setUploading(true)
    setProblem(null)
    try {
      const durationMs = await measureAudioMs(file)
      const asset = await library.upload(file, { kind, label: label.trim() || (kind === 'music' ? 'Music' : 'Voiceover'), durationMs, filename })
      setUploadLabel('')
      return asset
    } catch (err) {
      setProblem(videoErrorMessage(err, 'Could not upload the file.'))
      return null
    } finally {
      setUploading(false)
    }
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const asset = await upload(file, uploadKind, uploadLabel || file.name.replace(/\.[a-z0-9]+$/i, ''), file.name)
    if (fileRef.current) fileRef.current.value = ''
    if (!asset) return
    if (asset.kind === 'voiceover' && !timeline.voiceover) {
      onTimeline((tl) => ({ ...tl, voiceover: { asset_id: asset.id, volume: 1, start_ms: 0 } }))
    }
  }

  const toggleRecord = async () => {
    if (recording) {
      recorder.current?.stop()
      return
    }
    setProblem(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      const chunks: Blob[] = []
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data)
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        setRecording(false)
        const type = rec.mimeType || 'audio/webm'
        const blob = new Blob(chunks, { type: type.split(';')[0] })
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
        const asset = await upload(blob, 'voiceover', `Voiceover ${new Date().toLocaleString()}`, `voiceover.${ext}`)
        if (asset) onTimeline((tl) => ({ ...tl, voiceover: { asset_id: asset.id, volume: 1, start_ms: tl.voiceover?.start_ms ?? 0 } }))
      }
      recorder.current = rec
      rec.start()
      setRecording(true)
    } catch {
      setProblem('The microphone could not be opened. Allow it in the browser, or upload a recording instead.')
    }
  }

  const addSfx = (sound: SfxSound) => {
    const id = localId('sfx')
    onTimeline((tl) => ({ ...tl, sfx: [...tl.sfx, { id, sound, at_ms: Math.round(Math.min(timeMs, Math.max(0, totalMs - 100))), volume: 0.8 }] }))
    onSelectSfx(id)
  }

  return (
    <div className="flex flex-col gap-6">
      {problem && (
        <p className={NOTICE.error} role="alert">
          <CircleAlert size={15} aria-hidden="true" />
          {problem}
        </p>
      )}

      {/* Music */}
      <section className="flex flex-col gap-3">
        <h3 className={PANE_TITLE}>Music</h3>
        <Segmented
          value={mode}
          onChange={setMode}
          ariaLabel="Music"
          size="sm"
          options={[
            { value: 'none', label: 'None' },
            { value: 'chiptune', label: 'Chiptune' },
            { value: 'asset', label: 'From the library' },
          ]}
        />
        {music?.source === 'chiptune' && (
          <div className={ROW}>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-[160px] flex-1 flex-col gap-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-faint">
                Tune
                <select className={SELECT} value={music.preset} onChange={(e) => patchMusic({ preset: e.target.value as MusicPreset })}>
                  {MUSIC_PRESETS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label} — {p.hint}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className={BTN_SOFT} onClick={() => patchMusic({ seed: randomSeed() })} title="Same style, new melody">
                <Dices size={14} aria-hidden="true" />
                New tune
              </button>
              <button type="button" className={BTN_SOFT} onClick={() => void hearTune()}>
                {hearing ? <Square size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
                {hearing ? 'Stop' : 'Hear it'}
              </button>
            </div>
            <p className="text-[11.5px] text-faint">Made by the editor itself — no file, no licence. Tune #{music.seed}.</p>
            <Slider label="Volume" value={music.volume} onChange={(v) => patchMusic({ volume: v })} />
            <Slider label="Fade out" value={music.fade_out_ms / 1000} min={0} max={4} step={0.25} suffix={`${(music.fade_out_ms / 1000).toFixed(2)} s`} onChange={(v) => patchMusic({ fade_out_ms: Math.round(v * 1000) })} />
          </div>
        )}
        {music?.source === 'asset' && (
          <div className={ROW}>
            <label className="flex flex-col gap-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-faint">
              Track
              <select className={SELECT} value={music.asset_id} onChange={(e) => patchMusic({ asset_id: Number(e.target.value) })}>
                {musicAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                    {a.duration_ms ? ` · ${fmtSeconds(a.duration_ms)}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-faint">
              Starts at (s)
              <SecondsInput valueMs={music.start_ms} max={totalMs / 1000} onCommit={(ms) => patchMusic({ start_ms: ms })} />
            </label>
            <Slider label="Volume" value={music.volume} onChange={(v) => patchMusic({ volume: v })} />
            <Slider label="Fade out" value={music.fade_out_ms / 1000} min={0} max={4} step={0.25} suffix={`${(music.fade_out_ms / 1000).toFixed(2)} s`} onChange={(v) => patchMusic({ fade_out_ms: Math.round(v * 1000) })} />
          </div>
        )}
      </section>

      {/* Voiceover */}
      <section className="flex flex-col gap-3">
        <h3 className={PANE_TITLE}>Voiceover</h3>
        <div className={ROW}>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[160px] flex-1 flex-col gap-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-faint">
              Recording
              <select
                className={SELECT}
                value={timeline.voiceover?.asset_id ?? ''}
                onChange={(e) =>
                  onTimeline((tl) => ({
                    ...tl,
                    voiceover: e.target.value ? { asset_id: Number(e.target.value), volume: tl.voiceover?.volume ?? 1, start_ms: tl.voiceover?.start_ms ?? 0 } : null,
                  }))
                }
              >
                <option value="">None</option>
                {voiceAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                    {a.duration_ms ? ` · ${fmtSeconds(a.duration_ms)}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className={recording ? `${BTN_SOFT} border-red text-red` : BTN_SOFT} onClick={() => void toggleRecord()} disabled={uploading}>
              {recording ? <Square size={13} aria-hidden="true" /> : <Mic size={14} aria-hidden="true" />}
              {recording ? 'Stop and save' : 'Record a voiceover'}
            </button>
          </div>
          {recording && <p className="text-[12px] font-semibold text-red" role="status">Recording… speak now. Press “Stop and save” when you are done.</p>}
          {timeline.voiceover && (
            <>
              <label className="flex flex-col gap-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-faint">
                Starts at (s)
                <SecondsInput
                  valueMs={timeline.voiceover.start_ms}
                  max={totalMs / 1000}
                  onCommit={(ms) => onTimeline((tl) => (tl.voiceover ? { ...tl, voiceover: { ...tl.voiceover, start_ms: ms } } : tl))}
                />
              </label>
              <Slider
                label="Volume"
                value={timeline.voiceover.volume}
                onChange={(v) => onTimeline((tl) => (tl.voiceover ? { ...tl, voiceover: { ...tl.voiceover, volume: v } } : tl))}
              />
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ToggleSwitch
            on={timeline.ducking.enabled}
            onChange={(v) => onTimeline((tl) => ({ ...tl, ducking: { ...tl.ducking, enabled: v } }))}
            label="Lower the music under the voice"
          />
          <span className="min-w-[180px] flex-1 text-[12.5px] text-muted">Lower the music under the voice</span>
        </div>
        {timeline.ducking.enabled && (
          <Slider
            label="Music under the voice"
            value={timeline.ducking.music_under_voice}
            min={0.05}
            max={0.8}
            onChange={(v) => onTimeline((tl) => ({ ...tl, ducking: { ...tl.ducking, music_under_voice: v } }))}
          />
        )}
      </section>

      {/* Clip sound */}
      <section className="flex flex-col gap-3">
        <h3 className={PANE_TITLE}>Sound of the clips</h3>
        <Slider label="Seedance clips’ own sound" value={timeline.clip_audio_volume} onChange={(v) => onTimeline((tl) => ({ ...tl, clip_audio_volume: v }))} />
        <p className="text-[11.5px] text-faint">Kling clips are silent; Seedance clips bring their own sound.</p>
      </section>

      {/* Sound effects */}
      <section className="flex flex-col gap-3">
        <h3 className={PANE_TITLE}>Arcade sound effects</h3>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SFX_SOUNDS.map((s) => (
            <li key={s.key} className="flex items-center gap-2 rounded-row border border-hair bg-surface2/60 px-2.5 py-2">
              <button type="button" className={ICON_SQ} onClick={() => previewSfx(s.key)} aria-label={`Hear ${s.label}`}>
                <Volume2 size={15} aria-hidden="true" />
              </button>
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text">{s.label}</span>
              <button type="button" className={BTN_SOFT} onClick={() => addSfx(s.key)} disabled={totalMs <= 0}>
                <Plus size={13} aria-hidden="true" />
                At playhead
              </button>
            </li>
          ))}
        </ul>
        {timeline.sfx.length > 0 && (
          <ol className="flex flex-col gap-2">
            {[...timeline.sfx]
              .sort((a, b) => a.at_ms - b.at_ms)
              .map((s) => (
                <li
                  key={s.id}
                  className={`${ROW} ${selectedSfx === s.id ? 'border-accent-line shadow-[0_0_0_1px_var(--accent)]' : ''}`}
                  onFocusCapture={() => onSelectSfx(s.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 text-[13px] font-semibold text-text">{SFX_SOUNDS.find((x) => x.key === s.sound)?.label}</span>
                    <span className="w-[92px]">
                      <SecondsInput
                        valueMs={s.at_ms}
                        max={totalMs / 1000}
                        ariaLabel="At (seconds)"
                        onCommit={(ms) => onTimeline((tl) => ({ ...tl, sfx: tl.sfx.map((x) => (x.id === s.id ? { ...x, at_ms: ms } : x)) }))}
                      />
                    </span>
                    <button type="button" className={ICON_SQ} aria-label="Remove this effect" onClick={() => onTimeline((tl) => ({ ...tl, sfx: tl.sfx.filter((x) => x.id !== s.id) }))}>
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                  <Slider label="Volume" value={s.volume} onChange={(v) => onTimeline((tl) => ({ ...tl, sfx: tl.sfx.map((x) => (x.id === s.id ? { ...x, volume: v } : x)) }))} />
                </li>
              ))}
          </ol>
        )}
      </section>

      {/* Library */}
      <section className="flex flex-col gap-3">
        <h3 className={PANE_TITLE}>Audio library</h3>
        <p className="text-[12px] leading-[1.55] text-muted">
          Shared by the whole team, up to 40 files of 15 MB. Only upload music we hold the rights to.
        </p>
        <div className={ROW}>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[130px] flex-col gap-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-faint">
              Kind
              <select className={SELECT} value={uploadKind} onChange={(e) => setUploadKind(e.target.value as AudioKind)}>
                <option value="music">Music</option>
                <option value="voiceover">Voiceover</option>
              </select>
            </label>
            <label className="flex min-w-[160px] flex-1 flex-col gap-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-faint">
              Name
              <input className={INPUT} value={uploadLabel} maxLength={80} onChange={(e) => setUploadLabel(e.target.value)} placeholder="Upbeat synth loop" />
            </label>
            <button type="button" className={BTN_SOFT} onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload size={14} aria-hidden="true" />
              {uploading ? 'Uploading…' : 'Upload a file'}
            </button>
            <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          </div>
        </div>
        {assets.length === 0 ? (
          <p className="rounded-row border border-dashed border-border px-4 py-5 text-center text-[12.5px] text-muted">The library is empty.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-hair rounded-row border border-hair bg-surface2/60">
            {assets.map((a) => (
              <li key={a.id} className="flex items-center gap-2.5 px-3 py-2.5">
                {a.kind === 'music' ? <Music size={15} aria-hidden="true" className="flex-none text-silver" /> : <Mic size={15} aria-hidden="true" className="flex-none text-green" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-text">{a.label}</p>
                  <p className="truncate text-[11px] text-faint">
                    {a.duration_ms ? `${fmtSeconds(a.duration_ms)} · ` : ''}
                    {(a.bytes / 1024 / 1024).toFixed(1)} MB{a.created_by_name ? ` · ${a.created_by_name}` : ''} · {fmtDateTime(a.created_at)}
                  </p>
                </div>
                <button type="button" className={ICON_SQ} aria-label={`Delete ${a.label}`} onClick={() => setDeleting(a)}>
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmModal
        open={deleting !== null}
        title={`Delete “${deleting?.label ?? ''}”?`}
        message="It is removed from the library for the whole team. A file a video project still uses can’t be deleted — take it off that project first."
        confirmLabel="Delete"
        cancelLabel="Keep it"
        danger
        onConfirm={() => {
          const a = deleting
          setDeleting(null)
          if (!a) return
          library.remove(a.id).catch((err) => setProblem(videoErrorMessage(err, 'Could not delete the file.')))
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

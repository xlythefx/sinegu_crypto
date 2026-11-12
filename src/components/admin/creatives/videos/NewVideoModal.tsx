import { useEffect, useState } from 'react'
import { CircleAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Segmented } from '../../../ui/filters'
import { BTN_GHOST, BTN_PRIMARY, FIELD, HINT, INPUT, LABEL, SELECT } from '../../../settings/formClasses'
import { useApiData } from '../../../../hooks/useApiData'
import { ASPECTS, editorPath, videoErrorMessage } from '../../../../lib/creativeVideos'
import { getCreativeStyles } from '../../../../services/creativesAgent'
import { createCreativeVideo } from '../../../../services/creativeVideos'
import type { CreativePlatform } from '../../../../types/creatives'
import type { VideoAspect } from '../../../../types/creativeVideos'
import CreativeModal from '../CreativeModal'
import { NOTICE } from '../creativeClasses'

interface NewVideoModalProps {
  open: boolean
  onClose: () => void
}

/**
 * "New project": the three choices the agent would ask — platform, shape,
 * style — plus a title. Picking a style fills in its platform and shape
 * (they can still be changed here). Creating opens the editor. The shape is
 * fixed once the first clip is made, so it is asked now.
 */
export default function NewVideoModal({ open, onClose }: NewVideoModalProps) {
  const navigate = useNavigate()
  const { data: styles } = useApiData(() => (open ? getCreativeStyles() : Promise.resolve(null)), [open])
  const [title, setTitle] = useState('')
  const [platform, setPlatform] = useState<CreativePlatform>('tiktok')
  const [aspect, setAspect] = useState<VideoAspect>('9:16')
  const [styleId, setStyleId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTitle('')
    setPlatform('tiktok')
    setAspect('9:16')
    setStyleId('')
    setError(null)
  }, [open])

  const pickStyle = (id: string) => {
    setStyleId(id)
    const s = styles?.find((x) => String(x.id) === id)
    if (!s) return
    if (s.default_platform !== 'any') setPlatform(s.default_platform)
    setAspect(s.default_aspect)
  }

  const submit = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      const video = await createCreativeVideo({
        title: title.trim(),
        platform,
        aspect,
        ...(styleId ? { style_id: Number(styleId) } : {}),
      })
      onClose()
      navigate(editorPath(video.id))
    } catch (err) {
      setError(videoErrorMessage(err, 'Could not create the project.'))
    } finally {
      setSaving(false)
    }
  }

  const enabled = (styles ?? []).filter((s) => s.enabled)

  return (
    <CreativeModal open={open} title="New video project" subtitle="Up to 30 seconds. You add scenes in the editor — with AI, from the Gallery, or as free title cards." onClose={onClose} maxWidth={560}>
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <label className={FIELD}>
          <span className={LABEL}>Title</span>
          <input className={INPUT} value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="Week 46 recap" autoFocus />
        </label>

        <label className={FIELD}>
          <span className={LABEL}>Style</span>
          <select className={SELECT} value={styleId} onChange={(e) => pickStyle(e.target.value)}>
            <option value="">No style</option>
            {enabled.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <span className={HINT}>
            {styleId ? enabled.find((s) => String(s.id) === styleId)?.summary : 'A style sets the captions, template cards, music and Pixel look the video starts with.'}
          </span>
        </label>

        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>Platform</span>
          <Segmented
            value={platform}
            onChange={(p) => {
              setPlatform(p)
              if (!styleId) setAspect(p === 'tiktok' ? '9:16' : '16:9')
            }}
            ariaLabel="Platform"
            options={[
              { value: 'tiktok', label: 'TikTok' },
              { value: 'x', label: 'X' },
            ]}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>Shape</span>
          <Segmented value={aspect} onChange={setAspect} ariaLabel="Shape" options={ASPECTS.map((a) => ({ value: a.key, label: a.label }))} />
          <span className={HINT}>{ASPECTS.find((a) => a.key === aspect)?.hint}. Fixed once the first clip is made.</span>
        </div>

        {error && (
          <p className={NOTICE.error} role="alert">
            <CircleAlert size={15} aria-hidden="true" />
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2.5 border-t border-hair pt-4 sm:flex-row sm:justify-end">
          <button type="button" className={BTN_GHOST} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={BTN_PRIMARY} disabled={!title.trim() || saving}>
            {saving ? 'Creating…' : 'Create and open the editor'}
          </button>
        </div>
      </form>
    </CreativeModal>
  )
}

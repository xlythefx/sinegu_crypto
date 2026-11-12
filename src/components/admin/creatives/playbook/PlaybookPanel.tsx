import { BookOpen } from 'lucide-react'
import { useCreativePlaybook } from '../../../../hooks/useCreativePlaybook'
import { PLAYBOOK_MAX } from '../../../../lib/creativesAgent'
import MarkdownDocPanel from '../docs/MarkdownDocPanel'

interface PlaybookPanelProps {
  /** Unsaved edits — the workspace asks before the panel is closed or switched. */
  onDirtyChange: (dirty: boolean) => void
}

/**
 * The video playbook: the base every video follows — the anatomy of a video,
 * when Pixel appears, how scene prompts are written, Kling or Seedance, the
 * captions and the asking routine. A style (Styles panel) is the look on top.
 */
export default function PlaybookPanel({ onDirtyChange }: PlaybookPanelProps) {
  const { playbook, loading, error, reload, save } = useCreativePlaybook()
  return (
    <MarkdownDocPanel
      id="creatives-playbook"
      icon={BookOpen}
      title="Video playbook"
      subtitle="How every video is built: hook, scenes, captions, sound, when Pixel appears. The agent follows it for every video; a style adds the look."
      noun="playbook"
      max={PLAYBOOK_MAX}
      doc={playbook}
      loading={loading}
      error={error}
      reload={reload}
      save={save}
      onDirtyChange={onDirtyChange}
      placeholder={'# Anatomy of a video\n- A hook in the first 2 seconds\n- 3–6 scenes, 30 seconds at most'}
      emptyText="The playbook is empty. Switch to Edit and write how a Pixel Alpha video is put together."
      neverEdited="Nobody has edited it yet — this is the starting playbook."
      saveLabel="Save playbook"
    />
  )
}

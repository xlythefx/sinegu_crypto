import { FileText } from 'lucide-react'
import { useCreativeBrief } from '../../../../hooks/useCreativeBrief'
import { BRIEF_MAX } from '../../../../lib/creativesAgent'
import MarkdownDocPanel from '../docs/MarkdownDocPanel'

interface BriefPanelProps {
  /** Unsaved edits — the workspace asks before the panel is closed or switched. */
  onDirtyChange: (dirty: boolean) => void
}

/**
 * The brand brief: one Markdown document the agent reads before every answer
 * — who we are, the voice, Pixel, always / never, formats and the recipes.
 */
export default function BriefPanel({ onDirtyChange }: BriefPanelProps) {
  const { brief, loading, error, reload, save } = useCreativeBrief()
  return (
    <MarkdownDocPanel
      id="creatives-brief"
      icon={FileText}
      title="Brand brief"
      subtitle="The agent reads this before every answer and follows it. Keep it plain — no figures here; the week’s public results come from the track record."
      noun="brief"
      max={BRIEF_MAX}
      doc={brief}
      loading={loading}
      error={error}
      reload={reload}
      save={save}
      onDirtyChange={onDirtyChange}
      placeholder={'# Who we are\nPixel Alpha is …\n\n## Voice\n- Plain, friendly, never hype'}
      emptyText="The brief is empty. Switch to Edit and write who Pixel Alpha is, how it sounds and what to avoid."
      neverEdited="Nobody has edited it yet — this is the starting brief."
      saveLabel="Save brief"
    />
  )
}

import { Bot } from 'lucide-react'
import TonePill from '../TonePill'

/** "AI draft" — on a plan whose words came from Claude, and on a fresh draft. */
export default function AiDraftPill({ title }: { title?: string }) {
  return (
    <TonePill tone="accent" icon={Bot} title={title ?? 'Written with the AI writer — check it before posting'}>
      AI draft
    </TonePill>
  )
}

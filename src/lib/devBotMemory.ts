import type { DevBotMemory } from '../types/adminDevBot'

/** The whole memory as Markdown — the "Download .md" copy. */
export function memoriesToMarkdown(memories: DevBotMemory[]): string {
  const lines = ['# Pixel Alpha developer agent — memory', '', `Exported ${new Date().toISOString().slice(0, 10)}.`, '']
  for (const m of memories) {
    lines.push(`## ${m.title}`, '')
    if (m.signature) lines.push(`_About:_ \`${m.signature}\``, '')
    lines.push(m.body.trim(), '', `_${m.source === 'agent' ? 'Learned by the PC agent' : `Written by ${m.updated_by ?? 'an admin'}`}${m.job_id ? ` (job #${m.job_id})` : ''}${m.updated_at ? `, ${m.updated_at.slice(0, 10)}` : ''}._`, '')
  }
  return lines.join('\n')
}

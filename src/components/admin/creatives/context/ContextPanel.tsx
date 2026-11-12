import { useState } from 'react'
import { Braces, Check, Copy, RotateCw } from 'lucide-react'
import DataState from '../../../dashboard/DataState'
import Markdown from '../../../ui/Markdown'
import { Segmented } from '../../../ui/filters'
import { useApiData } from '../../../../hooks/useApiData'
import { getAgentContext } from '../../../../services/creativesAgent'
import type { CreativeAgentContextView } from '../../../../types/creatives'
import SectionHeader from '../SectionHeader'
import { BTN_SOFT, FACT_LABEL, SECTION } from '../creativeClasses'

interface ContextPanelProps {
  /** The open chat — the [Context] block is the one THIS chat would send next. */
  sessionId: string | null
}

type Section = 'system' | 'tools' | 'playbook' | 'brief' | 'memory' | 'styles' | 'context'

const SECTIONS: Array<{ value: Section; label: string }> = [
  { value: 'system', label: 'System rules' },
  { value: 'tools', label: 'Tools' },
  { value: 'playbook', label: 'Playbook' },
  { value: 'brief', label: 'Brief' },
  { value: 'memory', label: 'Memory' },
  { value: 'styles', label: 'Styles' },
  { value: 'context', label: 'This turn’s [Context]' },
]

const PRE =
  'max-h-[min(60dvh,620px)] overflow-auto whitespace-pre-wrap break-words rounded-row border border-hair bg-surface2/70 px-3.5 py-3 font-mono text-[11.5px] leading-[1.6] text-text [scrollbar-width:thin]'

/** The section as plain text, for Copy. */
function sectionText(ctx: CreativeAgentContextView, s: Section): string {
  switch (s) {
    case 'system':
      return ctx.system
    case 'tools':
      return ctx.tools.map((t) => `${t.name}\n${t.description}\n${JSON.stringify(t.input_schema, null, 2)}`).join('\n\n')
    case 'playbook':
      return ctx.playbook.markdown
    case 'brief':
      return ctx.brief.markdown
    case 'memory':
      return ctx.memory.text
    case 'styles':
      return ctx.styles.map((st) => `${st.slug} — ${st.name}: ${st.summary}`).join('\n')
    case 'context':
      return ctx.context_block
  }
}

function Version({ v }: { v: string | number | null }) {
  if (v === null || v === undefined || v === '') return null
  return <span className="font-mono text-[11px] text-faint">version {String(v)}</span>
}

/**
 * Read-only: exactly what the agent reads before it answers — its system
 * rules, its tools, the playbook, the brief, the team's memory, the styles
 * and the [Context] block the next message in this chat would carry. Nothing
 * here is sent or changed by opening it. Copy takes one section at a time.
 */
export default function ContextPanel({ sessionId }: ContextPanelProps) {
  const { data, loading, error, reload } = useApiData(() => getAgentContext(sessionId ?? undefined), [sessionId])
  const [section, setSection] = useState<Section>('system')
  const [copied, setCopied] = useState<Section | null>(null)

  const copy = async () => {
    if (!data) return
    try {
      await navigator.clipboard.writeText(sectionText(data, section))
      setCopied(section)
      window.setTimeout(() => setCopied((c) => (c === section ? null : c)), 1800)
    } catch {
      setCopied(null)
    }
  }

  return (
    <section className={SECTION} aria-labelledby="creatives-context">
      <SectionHeader
        icon={Braces}
        id="creatives-context"
        title="What the agent reads"
        subtitle="Everything the agent is given before it answers, as it is sent. Read-only — opening it changes nothing."
        actions={
          <button type="button" className={BTN_SOFT} onClick={reload} disabled={loading}>
            <RotateCw size={14} aria-hidden="true" className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      <Segmented value={section} onChange={setSection} options={SECTIONS} ariaLabel="Section" size="sm" />

      {!data ? (
        <DataState loading={loading} error={error} onRetry={reload} label="context" />
      ) : (
        <div key={section} className="flex flex-col gap-3 animate-[fadeup_0.3s_ease-out]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {section === 'playbook' && <Version v={data.playbook.version} />}
              {section === 'brief' && <Version v={data.brief.version} />}
              {section === 'memory' && <Version v={data.memory.version} />}
              {section === 'tools' && <span className="text-[12px] text-muted">{data.tools.length} tools</span>}
            </div>
            <button type="button" className={BTN_SOFT} onClick={() => void copy()}>
              {copied === section ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {copied === section ? 'Copied' : 'Copy'}
            </button>
          </div>

          {section === 'system' && <pre className={PRE}>{data.system || '—'}</pre>}
          {section === 'context' && <pre className={PRE}>{data.context_block || '—'}</pre>}
          {section === 'memory' && <pre className={PRE}>{data.memory.text || 'No memory notes yet.'}</pre>}
          {(section === 'playbook' || section === 'brief') && (
            <div className="max-h-[min(60dvh,620px)] overflow-y-auto rounded-row border border-hair bg-surface2/60 px-4 py-4">
              {(section === 'playbook' ? data.playbook.markdown : data.brief.markdown).trim() ? (
                <Markdown size="sm">{section === 'playbook' ? data.playbook.markdown : data.brief.markdown}</Markdown>
              ) : (
                <p className="text-[13px] text-muted">Empty.</p>
              )}
            </div>
          )}
          {section === 'styles' && (
            <ul className="flex flex-col divide-y divide-hair rounded-row border border-hair bg-surface2/60">
              {data.styles.length === 0 && <li className="px-4 py-4 text-[13px] text-muted">No styles are offered to the agent.</li>}
              {data.styles.map((st) => (
                <li key={st.slug} className="flex flex-col gap-1 px-4 py-3">
                  <span className="text-[13px] font-bold text-text">
                    {st.name} <span className="font-mono text-[11px] font-normal text-faint">{st.slug}</span>
                  </span>
                  <span className="text-[12.5px] leading-[1.5] text-muted">{st.summary}</span>
                </li>
              ))}
            </ul>
          )}
          {section === 'tools' && (
            <ul className="flex flex-col gap-2">
              {data.tools.map((t) => (
                <li key={t.name} className="rounded-row border border-hair bg-surface2/60 px-3.5 py-3">
                  <details>
                    <summary className="cursor-pointer list-none">
                      <span className="font-mono text-[12.5px] font-semibold text-accent">{t.name}</span>
                      <span className="mt-1 block text-[12.5px] leading-[1.5] text-muted">{t.description}</span>
                    </summary>
                    <p className={`${FACT_LABEL} mt-3`}>Inputs</p>
                    <pre className={`${PRE} mt-1.5`}>{JSON.stringify(t.input_schema, null, 2)}</pre>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

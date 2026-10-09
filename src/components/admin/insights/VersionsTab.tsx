import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, History, Search } from 'lucide-react'
import { Pill, type PillTone } from '../../ui/Pill'
import { ADMIN_CHANGES, adminChangeAreas, versionLabel } from '../../../lib/adminVersions'
import { fmtMediumDate } from '../../../lib/format'
import { collaboratorMayOpen, isCollaborator } from '../../../lib/roles'
import { useSessionUser } from '../../../hooks/useSessionUser'
import type { AdminChange } from '../../../types/adminVersions'

const KIND: Record<AdminChange['kind'], { label: string; tone: PillTone }> = {
  new: { label: 'New', tone: 'green' },
  improved: { label: 'Improved', tone: 'accent' },
  fixed: { label: 'Fixed', tone: 'muted' },
}

const CHIP_BASE =
  'min-h-[30px] rounded-pill border px-3 text-[12px] font-semibold transition-colors duration-150'
const CHIP_ON = 'border-accent bg-accent text-on-accent'
const CHIP_OFF = 'border-border bg-surface text-muted hover:text-text'

/**
 * Admin → Dashboard → Versions: what changed and how it works, newest first,
 * one version per day. Written for the owner and their employer — plain
 * words first, the developer detail folded away under each change. The list
 * is code (`lib/adminVersions.ts`), added to in the same change as the feature.
 */
export default function VersionsTab() {
  const collaborator = isCollaborator(useSessionUser()?.type)
  const [area, setArea] = useState<string>('all')
  const [query, setQuery] = useState('')
  const areas = useMemo(() => adminChangeAreas(), [])

  const versions = useMemo(() => {
    const q = query.trim().toLowerCase()
    const shown = ADMIN_CHANGES.filter((c) => {
      if (area !== 'all' && c.area !== area) return false
      if (!q) return true
      return [c.title, c.summary, c.area, ...c.howItWorks].join(' ').toLowerCase().includes(q)
    })
    const byDate = new Map<string, AdminChange[]>()
    for (const change of shown) {
      byDate.set(change.date, [...(byDate.get(change.date) ?? []), change])
    }
    return [...byDate.entries()].sort(([a], [b]) => b.localeCompare(a))
  }, [area, query])

  return (
    <div className="flex flex-col gap-stack">
      <section className="flex items-start gap-3 rounded-card border border-border bg-surface p-card">
        <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-accent-soft text-accent">
          <History size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[16px] font-extrabold">What’s new in Pixel Alpha</h2>
          <p className="mt-1 text-[13px] leading-[1.6] text-muted">
            Every new feature and change, newest first — what it does in plain words, how it works,
            and where to find it. Developer details are folded under each change.
          </p>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Filter by area">
          {['all', ...areas].map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={area === a}
              onClick={() => setArea(a)}
              className={`${CHIP_BASE} ${area === a ? CHIP_ON : CHIP_OFF}`}
            >
              {a === 'all' ? 'Everything' : a}
            </button>
          ))}
        </div>
        <label className="relative block sm:w-[240px]">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search changes"
            aria-label="Search changes"
            className="h-[38px] w-full rounded-field border border-border bg-surface2 pl-8 pr-3 text-[13px] text-text outline-none focus:border-accent"
          />
        </label>
      </div>

      <div key={`${area}-${query}`} className="flex flex-col gap-stack animate-[fadeup_0.35s_ease-out]">
        {versions.length === 0 && (
          <p className="rounded-card border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted">
            No changes match this filter.
          </p>
        )}
        {versions.map(([date, changes]) => (
          <section key={date} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="font-mono text-[14px] font-bold text-text">{versionLabel(date)}</h3>
              <span className="text-[12px] text-faint">
                {fmtMediumDate(date)} · {changes.length} change{changes.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {changes.map((change) => (
                <ChangeCard key={change.id} change={change} collaborator={collaborator} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function ChangeCard({ change, collaborator }: { change: AdminChange; collaborator: boolean }) {
  const [open, setOpen] = useState(false)
  const kind = KIND[change.kind]
  // A collaborator cannot open most admin pages; never show them a dead link.
  const links = (change.links ?? []).filter(
    (l) => !collaborator || !l.href.startsWith('/') || collaboratorMayOpen(l.href.split('?')[0]),
  )

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-card border border-border bg-surface p-card">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={kind.tone}>{kind.label}</Pill>
        <span className="text-[11.5px] font-semibold text-faint">{change.area}</span>
      </div>
      <h4 className="font-display text-[15px] font-extrabold leading-snug text-text">{change.title}</h4>
      <p className="text-[13px] leading-[1.6] text-muted">{change.summary}</p>

      <div>
        <p className="mb-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-faint">
          How it works
        </p>
        <ul className="flex flex-col gap-1.5">
          {change.howItWorks.map((line) => (
            <li key={line} className="flex items-start gap-2 text-[13px] leading-[1.55] text-muted">
              <span className="mt-[8px] h-1.5 w-1.5 flex-none rounded-full bg-accent" aria-hidden="true" />
              {line}
            </li>
          ))}
        </ul>
      </div>

      {(change.technical?.length || links.length > 0) && (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-hair pt-3">
          {change.technical?.length ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-faint hover:text-text"
            >
              <ChevronDown
                size={14}
                className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
              For developers
            </button>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap gap-2">
            {links.map((l) =>
              l.href.startsWith('/') ? (
                <Link
                  key={l.href}
                  to={l.href}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-border px-3 py-1.5 text-[12px] font-semibold text-text hover:border-accent"
                >
                  {l.label}
                  <ArrowRight size={13} aria-hidden="true" />
                </Link>
              ) : (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-pill border border-border px-3 py-1.5 text-[12px] font-semibold text-text hover:border-accent"
                >
                  {l.label}
                  <ArrowRight size={13} aria-hidden="true" />
                </a>
              ),
            )}
          </div>
        </div>
      )}

      {open && change.technical && (
        <ul className="flex flex-col gap-1.5 rounded-row border border-hair bg-surface2 p-3">
          {change.technical.map((line) => (
            <li key={line} className="break-words font-mono text-[11.5px] leading-[1.55] text-muted">
              {line}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

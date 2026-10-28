import { FileText, Flag, MonitorSmartphone } from 'lucide-react'
import { BarRow, EmptyNote, InsightCard } from '../insights/parts'
import { countryName, deviceTypeLabel } from '../../../lib/accessEvents'
import { visitPageLabel } from '../../../lib/visitPages'
import type { VisitorCount, VisitorSummary } from '../../../types/visitors'

function Bars<V extends string>({
  rows,
  label,
  empty = 'No visitors in this period yet.',
}: {
  rows: VisitorCount<V>[]
  label: (value: V | null) => string
  empty?: string
}) {
  if (rows.length === 0) return <EmptyNote>{empty}</EmptyNote>
  const max = Math.max(1, ...rows.map((r) => r.visitors))
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <BarRow key={r.value ?? '∅'} label={label(r.value)} value={r.visitors} max={max} />
      ))}
    </div>
  )
}

/** Which public pages people read, by visitors, with page views beside them. */
export function PagesCard({ pages }: { pages: VisitorSummary['pages'] }) {
  const max = Math.max(1, ...pages.map((p) => p.visitors))
  return (
    <InsightCard icon={FileText} title="Top pages" subtitle="Visitors · page views">
      {pages.length === 0 ? (
        <EmptyNote>No visitors in this period yet.</EmptyNote>
      ) : (
        <div className="flex flex-col gap-3">
          {pages.map((p) => (
            <BarRow
              key={p.path}
              label={visitPageLabel(p.path)}
              value={p.visitors}
              max={max}
              display={`${p.visitors.toLocaleString()} · ${p.views.toLocaleString()}`}
            />
          ))}
        </div>
      )}
    </InsightCard>
  )
}

export function CountriesCard({ countries }: { countries: VisitorSummary['countries'] }) {
  return (
    <InsightCard icon={Flag} title="Countries" subtitle="From the visitor's IP address">
      <Bars rows={countries} label={(code) => (code ? (countryName(code) ?? code) : 'Unknown')} />
    </InsightCard>
  )
}

/** Device type, then browser and system families (versions folded together). */
export function DevicesCard({
  devices,
  browsers,
  systems,
}: {
  devices: VisitorSummary['devices']
  browsers: VisitorSummary['browsers']
  systems: VisitorSummary['systems']
}) {
  const sub =
    'mb-2 mt-4 border-t border-hair pt-3 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint'
  return (
    <InsightCard icon={MonitorSmartphone} title="Devices" subtitle="What they visited on">
      <Bars rows={devices} label={(type) => (type ? deviceTypeLabel(type) : 'Unknown')} />
      {browsers.length > 0 && (
        <>
          <div className={sub}>Browser</div>
          <Bars rows={browsers} label={(b) => b ?? 'Other'} />
        </>
      )}
      {systems.length > 0 && (
        <>
          <div className={sub}>System</div>
          <Bars rows={systems} label={(os) => os ?? 'Other'} />
        </>
      )}
    </InsightCard>
  )
}

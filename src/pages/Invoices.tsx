import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { CheckCircle2, FileText } from 'lucide-react'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import DataState from '../components/dashboard/DataState'
import BillingStatsCards from '../components/billing/BillingStatsCards'
import BillingHelpSidebar from '../components/billing/BillingHelpSidebar'
import InvoiceCard from '../components/billing/InvoiceCard'
import { EXCHANGE_META, EXCHANGE_ORDER } from '../components/exchanges/meta'
import { useApiData } from '../hooks/useApiData'
import { getInvoices } from '../services/billing'
import { ApiError } from '../services/api'
import { calculateBillingStats } from '../lib/billing'
import type { ExchangeKind } from '../types/exchanges'

type Tab = 'outstanding' | 'history'
type Filter = 'all' | ExchangeKind
const FILTERS: Filter[] = ['all', ...EXCHANGE_ORDER]

export default function Invoices() {
  const { data, loading, error, reload } = useApiData(getInvoices)
  const [tab, setTab] = useState<Tab>('outstanding')
  const [filter, setFilter] = useState<Filter>('all')

  const invoices = useMemo(() => data ?? [], [data])
  const stats = useMemo(() => calculateBillingStats(invoices), [invoices])

  const filtered = useMemo(
    () => (filter === 'all' ? invoices : invoices.filter((i) => i.exchange === filter)),
    [invoices, filter]
  )

  const outstanding = filtered.filter((i) => i.status !== 'paid')
  const paid = filtered.filter((i) => i.status === 'paid')
  const rows = tab === 'outstanding' ? outstanding : paid

  const countFor = (f: Filter) =>
    f === 'all' ? invoices.length : invoices.filter((i) => i.exchange === f).length

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  if (!data) {
    return (
      <DashboardLayout title="Billing & Invoices">
        <DataState loading={loading} error={error} onRetry={reload} label="invoices" />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Billing & Invoices">
      <div className="mb-[22px]" data-aos="fade-up">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent mb-1.5">
          BILLING &amp; INVOICES
        </p>
        <h1 className="font-display text-[30px] font-extrabold tracking-[-0.02em] mb-1.5">
          Billing &amp; Invoices
        </h1>
        <p className="text-sm text-muted max-w-[560px]">
          Pay only in profit shares — a percentage of the gains your bots make,
          invoiced monthly across your connected exchanges.
        </p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-7 items-start max-[1080px]:grid-cols-1">
        <div className="min-w-0">
          <BillingStatsCards stats={stats} />

          <div
            className="flex items-center justify-between flex-wrap gap-3.5 mb-3.5"
            data-aos="fade-up"
          >
            <h2 className="inline-flex items-center gap-2 font-display text-[18px] font-bold">
              <FileText size={18} className="text-accent" /> Invoices
            </h2>
            <div
              className="inline-flex gap-1 p-1 border border-border rounded-[12px] bg-surface2"
              role="tablist"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'outstanding'}
                className={`text-[12.5px] font-semibold py-[7px] px-4 rounded-btn cursor-pointer transition-colors duration-150 ${
                  tab === 'outstanding'
                    ? 'bg-accent text-on-accent'
                    : 'bg-transparent text-muted hover:text-text'
                }`}
                onClick={() => setTab('outstanding')}
              >
                Outstanding
                {stats.outstandingCount > 0 && ` (${stats.outstandingCount})`}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'history'}
                className={`text-[12.5px] font-semibold py-[7px] px-4 rounded-btn cursor-pointer transition-colors duration-150 ${
                  tab === 'history'
                    ? 'bg-accent text-on-accent'
                    : 'bg-transparent text-muted hover:text-text'
                }`}
                onClick={() => setTab('history')}
              >
                History ({stats.totalPaymentsMade})
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-5" data-aos="fade-up">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className={`inline-flex items-center gap-1.5 border rounded-pill py-[7px] px-3.5 text-[12px] font-semibold cursor-pointer transition-[border-color,color] duration-150 ${
                  filter === f
                    ? 'bg-accent border-accent text-on-accent'
                    : 'border-border bg-surface2 text-muted hover:border-accent hover:text-text'
                }`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All Exchanges' : EXCHANGE_META[f].label}
                <span className="opacity-70 text-[11px]">({countFor(f)})</span>
              </button>
            ))}
          </div>

          {/* key on tab+filter re-mounts the list so it replays the fade-slide
              reveal on every tab/exchange switch instead of a hard cut. */}
          <div
            key={`${tab}-${filter}`}
            className="animate-[fadeup_0.35s_ease-out]"
          >
            {rows.length > 0 ? (
              <div className="flex flex-col gap-3.5">
                {rows.map((inv) => (
                  <InvoiceCard key={inv.id} invoice={inv} />
                ))}
              </div>
            ) : (
              <div className="rounded-card border border-dashed border-border bg-surface flex flex-col items-center text-center py-12 px-6">
                {tab === 'outstanding' ? (
                  <>
                    <CheckCircle2 size={44} className="text-green mb-3.5" />
                    <h3 className="text-[17px] font-bold mb-1.5">
                      No outstanding invoices
                    </h3>
                    <p className="text-[13px] text-muted">
                      {invoices.length === 0
                        ? 'You have no invoices yet. They are generated monthly from your trading profit.'
                        : 'All your billing periods have been paid.'}
                    </p>
                  </>
                ) : (
                  <>
                    <FileText size={44} className="text-faint mb-3.5" />
                    <h3 className="text-[17px] font-bold mb-1.5">No payment history</h3>
                    <p className="text-[13px] text-muted">
                      You haven't paid any billing periods yet.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <BillingHelpSidebar />
      </div>
    </DashboardLayout>
  )
}

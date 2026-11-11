import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import AnalyticsView from '../../analytics/AnalyticsView'
import { useApiData } from '../../../hooks/useApiData'
import { getAdminUserInvoices } from '../../../services/admin'
import type { AnalyticsFilters } from '../../../services/analytics'
import type { Analytics } from '../../../types/analytics'
import type { Invoice } from '../../../lib/billing'

interface UserAnalyticsTabProps {
  uniId: string
  user: { name: string | null; email: string | null }
  fetchAnalytics: (query: AnalyticsFilters) => Promise<Analytics>
  /**
   * False for a read-only collaborator: the API refuses them invoice reads
   * (403), so the monthly table simply has no billing column for them.
   */
  withInvoices: boolean
}

/**
 * A user's Performance Analytics as the admin reads it (2026-11-10): after
 * exchange fees first, and every month beside the invoice it was billed on,
 * so "what did they make" and "what did we charge" are one line. Clicking a
 * month's fee opens that invoice's page (/admin/invoices/:id) — the same page
 * Invoice History and the Invoices tab open; "Back" returns here.
 */
export default function UserAnalyticsTab({
  uniId,
  user,
  fetchAnalytics,
  withInvoices,
}: UserAnalyticsTabProps) {
  const navigate = useNavigate()
  // Every exchange: the analytics view narrows them to its own exchange filter.
  const fetchInvoices = useCallback(
    (): Promise<Invoice[] | null> =>
      withInvoices ? getAdminUserInvoices(uniId, 'all') : Promise.resolve(null),
    [uniId, withInvoices],
  )
  const { data: invoices } = useApiData(fetchInvoices, [fetchInvoices])

  return (
    <AnalyticsView
      fetchAnalytics={fetchAnalytics}
      sourceKey={uniId}
      showStrategyCard={false}
      capture={{ name: user.name || uniId }}
      showAfterFees
      // Undefined until loaded, so the column never flashes "No invoice".
      invoices={invoices ?? undefined}
      onOpenInvoice={
        withInvoices
          ? (inv) =>
              navigate(`/admin/invoices/${inv.id}`, {
                state: { backLabel: `Back to ${user.name || 'the profile'}` },
              })
          : undefined
      }
    />
  )
}

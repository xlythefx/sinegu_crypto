import { useCallback } from 'react'
import { Users } from 'lucide-react'
import { useApiData } from '../../../hooks/useApiData'
import { getAdminUserReferrals } from '../../../services/admin'
import { getApiErrorMessage } from '../../../services/api'
import { fmtMediumDate } from '../../../lib/format'

const TH =
  'text-left text-[10.5px] uppercase tracking-[0.07em] text-faint font-semibold py-2.5 px-3 border-b border-hair whitespace-nowrap'
const TD = 'py-3 px-3 border-b border-hair align-middle text-[13px]'

/** Users this account referred — name, email, referred date. Self-fetching. */
export default function UserReferralsTable({ uniId }: { uniId: string }) {
  const fetchReferrals = useCallback(() => getAdminUserReferrals(uniId), [uniId])
  const { data, loading, error } = useApiData(fetchReferrals, [fetchReferrals])
  const referrals = data ?? []

  return (
    <section className="flex flex-col rounded-card border border-border bg-surface p-card">
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="grid h-7 w-7 flex-none place-items-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
          <Users size={16} />
        </span>
        <div>
          <div className="font-display text-[15px] font-extrabold">Referrals</div>
          <div className="mt-px text-[12px] text-muted">
            {referrals.length} user{referrals.length === 1 ? '' : 's'} referred
          </div>
        </div>
      </div>

      {!data ? (
        <div className="grid min-h-[120px] flex-1 place-items-center px-4 text-center text-[13px] text-muted">
          {loading
            ? 'Loading referrals…'
            : getApiErrorMessage(error, 'Could not load referrals.')}
        </div>
      ) : referrals.length === 0 ? (
        <div className="grid min-h-[120px] flex-1 place-items-center rounded-row border border-dashed border-border bg-surface2 px-4 text-center text-[13px] text-muted">
          This user hasn't referred anyone yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>Name</th>
                <th className={TH}>Email</th>
                <th className={TH}>Referred at</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => (
                <tr
                  key={r.referred_user_uni_id}
                  className="transition-colors hover:bg-surface2"
                >
                  <td className={`${TD} font-semibold whitespace-nowrap`}>
                    {r.name}
                  </td>
                  <td className={`${TD} text-muted break-all`}>
                    {r.email ?? '—'}
                  </td>
                  <td className={`${TD} font-mono text-[12px] text-muted whitespace-nowrap`}>
                    {r.referred_at ? fmtMediumDate(r.referred_at) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

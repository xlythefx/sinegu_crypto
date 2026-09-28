import { ArrowDownToLine, ArrowUpFromLine, Landmark, Wallet } from 'lucide-react'
import MetricTile from '../../analytics/MetricTile'
import { InsightCard } from './parts'
import { fmtMoney } from '../../../lib/format'
import type { UnderManagement } from '../../../types/adminInsights'

interface UnderManagementCardProps {
  aum: UnderManagement
  /** Whose transfers the Deposited / Withdrawn tiles count. */
  flowsOf?: string
}

/** Live balances on connected accounts, split customers / master, plus 30 days of transfers. */
export default function UnderManagementCard({ aum, flowsOf = 'customers' }: UnderManagementCardProps) {
  const net30 = aum.deposits_30d - aum.withdrawals_30d

  return (
    <InsightCard
      icon={Landmark}
      title="Money under management"
      subtitle="Live balances on connected exchange accounts"
    >
      <div className="grid grid-cols-2 gap-2.5 max-[480px]:grid-cols-1">
        <MetricTile label="Customers" icon={Wallet} value={fmtMoney(aum.customers)} sub={`${aum.customer_accounts} live account${aum.customer_accounts === 1 ? '' : 's'}`} />
        <MetricTile label="Master" icon={Wallet} value={fmtMoney(aum.master)} sub="the published track record" />
        <MetricTile label="Deposited" icon={ArrowDownToLine} value={fmtMoney(aum.deposits_30d)} tone="pos" sub={`by ${flowsOf}, last 30 days`} />
        <MetricTile
          label="Withdrawn"
          icon={ArrowUpFromLine}
          value={fmtMoney(aum.withdrawals_30d)}
          tone={aum.withdrawals_30d > 0 ? 'neg' : ''}
          sub={`net ${net30 < 0 ? '−' : '+'}${fmtMoney(net30)} in 30 days`}
        />
      </div>
    </InsightCard>
  )
}

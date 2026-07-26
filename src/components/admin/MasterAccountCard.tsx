import { Shield } from 'lucide-react'
import { fmtDateTime, fmtMoney } from '../../lib/format'
import type { MasterStats } from '../../types/admin'
import './MasterAccountCard.css'

interface MasterAccountCardProps {
  master: MasterStats['master']
  stats: MasterStats['stats']
}

/** Master account summary: badges, masked credentials, last trade. */
export default function MasterAccountCard({
  master,
  stats,
}: MasterAccountCardProps) {
  const account = master.account

  return (
    <section className="dcard amac" data-aos="fade-up">
      <div className="dcard__title-row">
        <span className="dchip">
          <Shield size={16} />
        </span>
        <div>
          <div className="dcard__title amac__title">Master Account</div>
          <div className="dcard__sub">
            Primary live account feeding platform performance.
          </div>
        </div>
      </div>

      <div className="amac__badges">
        <span className="amac__badge">ID: {account?.id ?? '—'}</span>
        <span className="amac__badge amac__badge--name">{master.name}</span>
        <span className="amac__badge amac__badge--accent">
          {account?.demo ? 'Demo' : 'Live'}
        </span>
        <span className="amac__badge amac__badge--accent">
          {account?.enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      <div className="amac__info">
        <p>
          <b>Email:</b> {master.email}
        </p>
        <p>
          <b>API Key:</b>{' '}
          <span className="amac__mono">
            {account?.api_key ?? 'Not connected'}
          </span>
        </p>
        <p>
          <b>Balance:</b>{' '}
          <span className="amac__mono">
            {fmtMoney(stats.balance)} {account?.currency_type ?? 'USDT'}
          </span>
        </p>
      </div>

      <div className="amac__last">
        <span className="amac__last-label">Last Trade</span>
        <span className="amac__last-val">
          {stats.last_trade_at ? fmtDateTime(stats.last_trade_at) : 'No trades yet'}
        </span>
      </div>
    </section>
  )
}

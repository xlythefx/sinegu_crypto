import { Coins, CreditCard, HandCoins } from 'lucide-react'
import type { PaymentKind } from '../../../types/admin'

const STYLE: Record<Exclude<PaymentKind, 'unknown'>, { name: string; Icon: typeof Coins; cls: string }> = {
  // Stripe's own violet; our gold for crypto; a quiet chip for "by hand".
  card: { name: 'Stripe', Icon: CreditCard, cls: 'bg-[#635BFF] text-white border-transparent' },
  crypto: { name: 'Crypto', Icon: Coins, cls: 'bg-accent text-on-accent border-transparent' },
  manual: { name: 'By hand', Icon: HandCoins, cls: 'bg-surface2 text-muted border-border' },
}

/**
 * How an invoice was paid, at a glance — Stripe / Crypto / By hand (owner,
 * 2026-11-11: "must cite how it was paid"). Renders nothing for a payment
 * whose rail was never recorded, so an old row never shows a wrong badge.
 * `title` carries the full wording (e.g. "Bank transfer") on hover.
 */
export default function PaidViaBadge({
  kind,
  title,
  size = 'sm',
}: {
  kind: PaymentKind
  title?: string
  size?: 'sm' | 'md'
}) {
  if (kind === 'unknown') return null
  const { name, Icon, cls } = STYLE[kind]
  const sizing =
    size === 'md' ? 'gap-1.5 py-[3px] px-2.5 text-[11.5px]' : 'gap-1 py-[2px] px-[7px] text-[10px]'
  return (
    <span
      className={`inline-flex items-center rounded-pill border font-bold whitespace-nowrap ${sizing} ${cls}`}
      title={title ?? `Paid by ${name.toLowerCase()}`}
    >
      <Icon size={size === 'md' ? 12 : 10} /> {name}
    </span>
  )
}

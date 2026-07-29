import { useState } from 'react'
import { Calendar, CreditCard, Trash2 } from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import {
  CARD_HWM,
  CARD_HEAD,
  CARD_SUB,
  CARD_TITLE,
  CARD_TITLES,
  CHIP,
  ICON_BTN_DANGER,
  LABEL,
} from './formClasses'
import { SAVED_CARDS, type SavedCard } from './mockData'

/**
 * Card on file used for automatic invoice payments.
 *
 * NOT RENDERED — hidden from Settings until the Stripe phase lands (there is no
 * saved-card table or endpoint on sinegutrade-api yet, so the data below is
 * static prototype data). Kept so the UI can be dropped back into Settings.tsx
 * once real cards exist; delete both this file and mockData.ts if the design
 * changes instead.
 */
export default function PaymentMethodCard() {
  const [cards, setCards] = useState<SavedCard[]>(SAVED_CARDS)
  const [toDelete, setToDelete] = useState<SavedCard | null>(null)

  const card = cards[0]

  return (
    <section
      className={`${CARD_HWM} flex flex-col`}
      data-aos="fade-up"
      data-aos-delay="100"
    >
      <div className={CARD_HEAD}>
        <span className={CHIP}>
          <CreditCard size={15} />
        </span>
        <div className={CARD_TITLES}>
          <h3 className={CARD_TITLE}>Payment Method</h3>
          <p className={CARD_SUB}>Card used for automatic billing</p>
        </div>
        {card && (
          <button
            type="button"
            className={ICON_BTN_DANGER}
            onClick={() => setToDelete(card)}
            title="Delete payment method"
            aria-label="Delete payment method"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {card ? (
        <div className="flex-1 flex flex-col justify-between gap-[22px]">
          <div>
            <p className={`${LABEL} mb-2`}>
              <CreditCard size={13} />
              Card Number
            </p>
            <p className="font-mono text-[20px] font-bold tracking-[0.08em]">
              •••• •••• •••• {card.last4}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-3.5 border-t border-accent-line">
            <div>
              <p className={`${LABEL} mb-2`}>
                <Calendar size={13} />
                Expires
              </p>
              <p className="text-[16px] font-extrabold">{card.expiry}</p>
            </div>
            <div>
              <p className={`${LABEL} mb-2`}>
                <CreditCard size={13} />
                Brand
              </p>
              <p className="text-[16px] font-extrabold">{card.brand}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-[18px]">
          <div className="flex flex-col items-center justify-center gap-[7px] w-[210px] h-32 mb-2.5 border-[3px] border-dashed border-accent-line rounded-[14px] bg-accent-soft text-accent">
            <CreditCard size={38} />
            <span className="w-16 h-1 rounded-[2px] bg-accent-line" />
            <span className="w-11 h-1 rounded-[2px] bg-accent-line" />
          </div>
          <h4 className="font-display text-[15px] font-extrabold">
            No Payment Method
          </h4>
          <p className="text-[12.5px] text-muted leading-[1.5] max-w-[280px]">
            Pay your first invoice to connect your card and enable automatic
            payments for future billing.
          </p>
        </div>
      )}

      <ConfirmModal
        open={toDelete !== null}
        title="Delete payment method?"
        message={
          toDelete
            ? `${toDelete.brand} ending in ${toDelete.last4} will be removed. Future invoices will need to be paid manually.`
            : undefined
        }
        confirmLabel="Yes, delete"
        cancelLabel="No"
        danger
        onConfirm={() => {
          setCards((prev) => prev.filter((c) => c.id !== toDelete?.id))
          setToDelete(null)
        }}
        onCancel={() => setToDelete(null)}
      />
    </section>
  )
}

import { useState } from 'react'
import { Calendar, CreditCard, Trash2 } from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import { SAVED_CARDS, type SavedCard } from './mockData'

/**
 * Card on file used for automatic invoice payments.
 * Static prototype data — wired to Stripe via the API later.
 */
export default function PaymentMethodCard() {
  const [cards, setCards] = useState<SavedCard[]>(SAVED_CARDS)
  const [toDelete, setToDelete] = useState<SavedCard | null>(null)

  const card = cards[0]

  return (
    <section className="dcard dcard--hwm set-card spm" data-aos="fade-up" data-aos-delay="100">
      <div className="dcard__title-row set-card__head">
        <span className="dchip">
          <CreditCard size={15} />
        </span>
        <div className="set-card__titles">
          <h3 className="dcard__title">Payment Method</h3>
          <p className="dcard__sub">Card used for automatic billing</p>
        </div>
        {card && (
          <button
            type="button"
            className="sicon-btn sicon-btn--danger"
            onClick={() => setToDelete(card)}
            title="Delete payment method"
            aria-label="Delete payment method"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {card ? (
        <div className="spm__body">
          <div>
            <p className="sfield__label spm__label">
              <CreditCard size={13} />
              Card Number
            </p>
            <p className="spm__number mono">•••• •••• •••• {card.last4}</p>
          </div>
          <div className="spm__meta">
            <div>
              <p className="sfield__label spm__label">
                <Calendar size={13} />
                Expires
              </p>
              <p className="spm__meta-value">{card.expiry}</p>
            </div>
            <div>
              <p className="sfield__label spm__label">
                <CreditCard size={13} />
                Brand
              </p>
              <p className="spm__meta-value">{card.brand}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="spm__empty">
          <div className="spm__placeholder">
            <CreditCard size={38} />
            <span className="spm__ph-bar spm__ph-bar--wide" />
            <span className="spm__ph-bar" />
          </div>
          <h4 className="spm__empty-title">No Payment Method</h4>
          <p className="spm__empty-sub">
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

import { useState } from 'react'
import { AlertCircle, Building2, Plus, Save, Trash2 } from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import {
  BANK_ACCOUNTS,
  type BankAccount,
  type BankCurrency,
} from './mockData'

interface BankWireForm {
  currency: BankCurrency
  label: string
  holderName: string
  bankName: string
  bankAddress: string
  accountType: string
  routingNumber: string
  accountNumber: string
  swiftBic: string
  iban: string
}

const EMPTY_FORM: BankWireForm = {
  currency: 'USD',
  label: '',
  holderName: '',
  bankName: '',
  bankAddress: '',
  accountType: '',
  routingNumber: '',
  accountNumber: '',
  swiftBic: '',
  iban: '',
}

/**
 * Bank wire payout accounts (USD/EUR variants).
 * Static prototype data — wired to the API once payout endpoints exist.
 */
export default function BankWireCard() {
  const [accounts, setAccounts] = useState<BankAccount[]>(BANK_ACCOUNTS)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<BankWireForm>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<BankAccount | null>(null)

  const setField =
    (key: keyof BankWireForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const openForm = () => {
    setForm(EMPTY_FORM)
    setError(null)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setError(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.holderName.trim() || !form.bankName.trim()) {
      setError('Account holder name and bank name are required.')
      return
    }
    if (form.currency === 'EUR' && !form.iban.trim()) {
      setError('IBAN is required for EUR accounts.')
      return
    }
    if (form.currency === 'USD' && !form.accountNumber.trim()) {
      setError('Account number is required for USD accounts.')
      return
    }

    setAccounts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: form.label.trim(),
        currency: form.currency,
        holderName: form.holderName.trim(),
        bankName: form.bankName.trim(),
        bankAddress: form.bankAddress.trim(),
        accountType: form.currency === 'USD' ? form.accountType : '',
        routingNumber: form.currency === 'USD' ? form.routingNumber.trim() : '',
        accountNumber: form.currency === 'USD' ? form.accountNumber.trim() : '',
        swiftBic: form.swiftBic.trim(),
        iban: form.currency === 'EUR' ? form.iban.trim() : '',
      },
    ])
    closeForm()
  }

  return (
    <section className="dcard set-card sbw" data-aos="fade-up">
      <div className="dcard__title-row set-card__head">
        <span className="dchip">
          <Building2 size={15} />
        </span>
        <div className="set-card__titles">
          <h3 className="dcard__title">Bank Wire Accounts</h3>
          <p className="dcard__sub">Bank details for wire transfer payouts</p>
        </div>
        {!showForm && (
          <button type="button" className="sbtn sbtn--primary sbtn--sm" onClick={openForm}>
            <Plus size={13} />
            Add Account
          </button>
        )}
      </div>

      {accounts.length > 0 && (
        <div className="sbw__list">
          {accounts.map((acct) => (
            <div className="sbw__item" key={acct.id}>
              <div className="sbw__item-head">
                <div className="sbw__item-id">
                  <span className="dchip">
                    <Building2 size={14} />
                  </span>
                  <div>
                    <p className="sbw__item-name">{acct.label || acct.holderName}</p>
                    <p className="sbw__item-net mono">
                      {acct.currency} · {acct.bankName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="sicon-btn sicon-btn--danger"
                  onClick={() => setToDelete(acct)}
                  title="Delete account"
                  aria-label="Delete account"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="sbw__details">
                <span className="sbw__dt">Account holder</span>
                <span className="sbw__dd">{acct.holderName}</span>
                {acct.currency === 'EUR' && acct.iban && (
                  <>
                    <span className="sbw__dt">IBAN</span>
                    <span className="sbw__dd mono">{acct.iban}</span>
                  </>
                )}
                {acct.currency === 'USD' && acct.accountNumber && (
                  <>
                    <span className="sbw__dt">Account #</span>
                    <span className="sbw__dd mono">{acct.accountNumber}</span>
                  </>
                )}
                {acct.currency === 'USD' && acct.routingNumber && (
                  <>
                    <span className="sbw__dt">Routing #</span>
                    <span className="sbw__dd mono">{acct.routingNumber}</span>
                  </>
                )}
                {acct.swiftBic && (
                  <>
                    <span className="sbw__dt">SWIFT/BIC</span>
                    <span className="sbw__dd mono">{acct.swiftBic}</span>
                  </>
                )}
                {acct.bankAddress && (
                  <>
                    <span className="sbw__dt">Bank address</span>
                    <span className="sbw__dd">{acct.bankAddress}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form className="set-form sbw__form" onSubmit={handleSubmit}>
          {error && (
            <div className="snotice snotice--error" role="alert">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}
          <div className="sbw__form-grid">
            <div className="sfield">
              <label className="sfield__label" htmlFor="bw-currency">
                Currency *
              </label>
              <select
                id="bw-currency"
                className="sinput"
                value={form.currency}
                onChange={setField('currency')}
              >
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
              </select>
            </div>
            <div className="sfield">
              <label className="sfield__label" htmlFor="bw-label">
                Label (optional)
              </label>
              <input
                id="bw-label"
                className="sinput"
                type="text"
                placeholder="e.g. My USD Business Account"
                value={form.label}
                onChange={setField('label')}
              />
            </div>
            <div className="sfield">
              <label className="sfield__label" htmlFor="bw-holder">
                Account Holder Name *
              </label>
              <input
                id="bw-holder"
                className="sinput"
                type="text"
                placeholder="Full legal name"
                value={form.holderName}
                onChange={setField('holderName')}
              />
            </div>
            <div className="sfield">
              <label className="sfield__label" htmlFor="bw-bank">
                Bank Name *
              </label>
              <input
                id="bw-bank"
                className="sinput"
                type="text"
                placeholder="e.g. Chase Bank"
                value={form.bankName}
                onChange={setField('bankName')}
              />
            </div>
            {form.currency === 'EUR' ? (
              <>
                <div className="sfield">
                  <label className="sfield__label" htmlFor="bw-iban">
                    IBAN *
                  </label>
                  <input
                    id="bw-iban"
                    className="sinput sinput--mono"
                    type="text"
                    placeholder="e.g. DE89370400440532013000"
                    value={form.iban}
                    onChange={setField('iban')}
                  />
                </div>
                <div className="sfield">
                  <label className="sfield__label" htmlFor="bw-swift">
                    SWIFT / BIC
                  </label>
                  <input
                    id="bw-swift"
                    className="sinput sinput--mono"
                    type="text"
                    placeholder="e.g. COBADEFFXXX"
                    value={form.swiftBic}
                    onChange={setField('swiftBic')}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="sfield">
                  <label className="sfield__label" htmlFor="bw-type">
                    Account Type
                  </label>
                  <select
                    id="bw-type"
                    className="sinput"
                    value={form.accountType}
                    onChange={setField('accountType')}
                  >
                    <option value="">Select type</option>
                    <option value="Checking">Checking</option>
                    <option value="Savings">Savings</option>
                  </select>
                </div>
                <div className="sfield">
                  <label className="sfield__label" htmlFor="bw-routing">
                    Routing Number
                  </label>
                  <input
                    id="bw-routing"
                    className="sinput sinput--mono"
                    type="text"
                    placeholder="9-digit ABA routing number"
                    value={form.routingNumber}
                    onChange={setField('routingNumber')}
                  />
                </div>
                <div className="sfield">
                  <label className="sfield__label" htmlFor="bw-number">
                    Account Number *
                  </label>
                  <input
                    id="bw-number"
                    className="sinput sinput--mono"
                    type="text"
                    placeholder="Bank account number"
                    value={form.accountNumber}
                    onChange={setField('accountNumber')}
                  />
                </div>
                <div className="sfield">
                  <label className="sfield__label" htmlFor="bw-swift-usd">
                    SWIFT / BIC
                  </label>
                  <input
                    id="bw-swift-usd"
                    className="sinput sinput--mono"
                    type="text"
                    placeholder="e.g. CHASUS33"
                    value={form.swiftBic}
                    onChange={setField('swiftBic')}
                  />
                </div>
              </>
            )}
            <div className="sfield sbw__form-wide">
              <label className="sfield__label" htmlFor="bw-address">
                Bank Address
              </label>
              <input
                id="bw-address"
                className="sinput"
                type="text"
                placeholder="Optional full bank address"
                value={form.bankAddress}
                onChange={setField('bankAddress')}
              />
            </div>
          </div>
          <div className="set-form__actions">
            <button type="button" className="sbtn sbtn--ghost sbtn--sm" onClick={closeForm}>
              Cancel
            </button>
            <button type="submit" className="sbtn sbtn--primary sbtn--sm">
              <Save size={13} />
              Save Account
            </button>
          </div>
        </form>
      )}

      {accounts.length === 0 && !showForm && (
        <p className="set-empty">
          No bank wire accounts yet. Click "Add Account" to add one.
        </p>
      )}

      <ConfirmModal
        open={toDelete !== null}
        title="Delete bank wire account?"
        message={
          toDelete
            ? `"${toDelete.label || toDelete.holderName}" (${toDelete.currency} · ${toDelete.bankName}) will be removed from your payout options.`
            : undefined
        }
        confirmLabel="Yes, delete"
        cancelLabel="No"
        danger
        onConfirm={() => {
          setAccounts((prev) => prev.filter((a) => a.id !== toDelete?.id))
          setToDelete(null)
        }}
        onCancel={() => setToDelete(null)}
      />
    </section>
  )
}

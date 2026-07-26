import { useState } from 'react'
import { AlertCircle, Building2, Plus, Save, Trash2 } from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import {
  BTN_GHOST_SM,
  BTN_PRIMARY_SM,
  CARD,
  CARD_HEAD,
  CARD_SUB,
  CARD_TITLE,
  CARD_TITLES,
  CHIP,
  EMPTY,
  FIELD,
  FORM,
  FORM_ACTIONS_ACCENT,
  ICON_BTN_DANGER,
  INPUT,
  INPUT_MONO,
  LABEL,
  SELECT,
  notice,
} from './formClasses'
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
    <section className={`${CARD} flex flex-col mb-4`} data-aos="fade-up">
      <div className={CARD_HEAD}>
        <span className={CHIP}>
          <Building2 size={15} />
        </span>
        <div className={CARD_TITLES}>
          <h3 className={CARD_TITLE}>Bank Wire Accounts</h3>
          <p className={CARD_SUB}>Bank details for wire transfer payouts</p>
        </div>
        {!showForm && (
          <button type="button" className={BTN_PRIMARY_SM} onClick={openForm}>
            <Plus size={13} />
            Add Account
          </button>
        )}
      </div>

      {accounts.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {accounts.map((acct) => (
            <div
              className="p-3 border border-border rounded-row bg-surface2 transition-[border-color] duration-150 hover:border-accent-line"
              key={acct.id}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={CHIP}>
                    <Building2 size={14} />
                  </span>
                  <div>
                    <p className="text-[13px] font-bold">
                      {acct.label || acct.holderName}
                    </p>
                    <p className="font-mono text-[10.5px] tracking-[0.08em] uppercase text-accent mt-0.5">
                      {acct.currency} · {acct.bankName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className={ICON_BTN_DANGER}
                  onClick={() => setToDelete(acct)}
                  title="Delete account"
                  aria-label="Delete account"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 mt-2.5 text-[12px]">
                <span className="text-faint">Account holder</span>
                <span className="font-semibold [overflow-wrap:anywhere]">
                  {acct.holderName}
                </span>
                {acct.currency === 'EUR' && acct.iban && (
                  <>
                    <span className="text-faint">IBAN</span>
                    <span className="font-mono font-semibold [overflow-wrap:anywhere]">
                      {acct.iban}
                    </span>
                  </>
                )}
                {acct.currency === 'USD' && acct.accountNumber && (
                  <>
                    <span className="text-faint">Account #</span>
                    <span className="font-mono font-semibold [overflow-wrap:anywhere]">
                      {acct.accountNumber}
                    </span>
                  </>
                )}
                {acct.currency === 'USD' && acct.routingNumber && (
                  <>
                    <span className="text-faint">Routing #</span>
                    <span className="font-mono font-semibold [overflow-wrap:anywhere]">
                      {acct.routingNumber}
                    </span>
                  </>
                )}
                {acct.swiftBic && (
                  <>
                    <span className="text-faint">SWIFT/BIC</span>
                    <span className="font-mono font-semibold [overflow-wrap:anywhere]">
                      {acct.swiftBic}
                    </span>
                  </>
                )}
                {acct.bankAddress && (
                  <>
                    <span className="text-faint">Bank address</span>
                    <span className="font-semibold [overflow-wrap:anywhere]">
                      {acct.bankAddress}
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form
          className={`${FORM} mt-3.5 p-3.5 border border-accent-line rounded-row bg-accent-soft`}
          onSubmit={handleSubmit}
        >
          {error && (
            <div className={notice('error')} role="alert">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3.5 max-[900px]:grid-cols-1">
            <div className={FIELD}>
              <label className={LABEL} htmlFor="bw-currency">
                Currency *
              </label>
              <select
                id="bw-currency"
                className={SELECT}
                value={form.currency}
                onChange={setField('currency')}
              >
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
              </select>
            </div>
            <div className={FIELD}>
              <label className={LABEL} htmlFor="bw-label">
                Label (optional)
              </label>
              <input
                id="bw-label"
                className={INPUT}
                type="text"
                placeholder="e.g. My USD Business Account"
                value={form.label}
                onChange={setField('label')}
              />
            </div>
            <div className={FIELD}>
              <label className={LABEL} htmlFor="bw-holder">
                Account Holder Name *
              </label>
              <input
                id="bw-holder"
                className={INPUT}
                type="text"
                placeholder="Full legal name"
                value={form.holderName}
                onChange={setField('holderName')}
              />
            </div>
            <div className={FIELD}>
              <label className={LABEL} htmlFor="bw-bank">
                Bank Name *
              </label>
              <input
                id="bw-bank"
                className={INPUT}
                type="text"
                placeholder="e.g. Chase Bank"
                value={form.bankName}
                onChange={setField('bankName')}
              />
            </div>
            {form.currency === 'EUR' ? (
              <>
                <div className={FIELD}>
                  <label className={LABEL} htmlFor="bw-iban">
                    IBAN *
                  </label>
                  <input
                    id="bw-iban"
                    className={INPUT_MONO}
                    type="text"
                    placeholder="e.g. DE89370400440532013000"
                    value={form.iban}
                    onChange={setField('iban')}
                  />
                </div>
                <div className={FIELD}>
                  <label className={LABEL} htmlFor="bw-swift">
                    SWIFT / BIC
                  </label>
                  <input
                    id="bw-swift"
                    className={INPUT_MONO}
                    type="text"
                    placeholder="e.g. COBADEFFXXX"
                    value={form.swiftBic}
                    onChange={setField('swiftBic')}
                  />
                </div>
              </>
            ) : (
              <>
                <div className={FIELD}>
                  <label className={LABEL} htmlFor="bw-type">
                    Account Type
                  </label>
                  <select
                    id="bw-type"
                    className={SELECT}
                    value={form.accountType}
                    onChange={setField('accountType')}
                  >
                    <option value="">Select type</option>
                    <option value="Checking">Checking</option>
                    <option value="Savings">Savings</option>
                  </select>
                </div>
                <div className={FIELD}>
                  <label className={LABEL} htmlFor="bw-routing">
                    Routing Number
                  </label>
                  <input
                    id="bw-routing"
                    className={INPUT_MONO}
                    type="text"
                    placeholder="9-digit ABA routing number"
                    value={form.routingNumber}
                    onChange={setField('routingNumber')}
                  />
                </div>
                <div className={FIELD}>
                  <label className={LABEL} htmlFor="bw-number">
                    Account Number *
                  </label>
                  <input
                    id="bw-number"
                    className={INPUT_MONO}
                    type="text"
                    placeholder="Bank account number"
                    value={form.accountNumber}
                    onChange={setField('accountNumber')}
                  />
                </div>
                <div className={FIELD}>
                  <label className={LABEL} htmlFor="bw-swift-usd">
                    SWIFT / BIC
                  </label>
                  <input
                    id="bw-swift-usd"
                    className={INPUT_MONO}
                    type="text"
                    placeholder="e.g. CHASUS33"
                    value={form.swiftBic}
                    onChange={setField('swiftBic')}
                  />
                </div>
              </>
            )}
            <div className={`${FIELD} col-span-full`}>
              <label className={LABEL} htmlFor="bw-address">
                Bank Address
              </label>
              <input
                id="bw-address"
                className={INPUT}
                type="text"
                placeholder="Optional full bank address"
                value={form.bankAddress}
                onChange={setField('bankAddress')}
              />
            </div>
          </div>
          <div className={FORM_ACTIONS_ACCENT}>
            <button type="button" className={BTN_GHOST_SM} onClick={closeForm}>
              Cancel
            </button>
            <button type="submit" className={BTN_PRIMARY_SM}>
              <Save size={13} />
              Save Account
            </button>
          </div>
        </form>
      )}

      {accounts.length === 0 && !showForm && (
        <p className={EMPTY}>
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

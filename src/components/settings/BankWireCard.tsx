import { useState } from 'react'
import {
  AlertCircle,
  Building2,
  Pencil,
  Plus,
  Save,
  Star,
  Trash2,
} from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import {
  addBank,
  deleteBank,
  setMainPayoutMethod,
  updateBank,
  type BankInput,
} from '../../services/payoutMethods'
import { getApiErrorMessage } from '../../services/api'
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
  ICON_BTN,
  ICON_BTN_DANGER,
  INPUT,
  INPUT_MONO,
  LABEL,
  LOADING,
  SELECT,
  notice,
} from './formClasses'
import type { BankWireAccount } from '../../types/referrals'

interface BankWireCardProps {
  /** null while payout methods are loading (or failed — see loadError). */
  accounts: BankWireAccount[] | null
  loadError: string | null
  /** Refetch payout methods after any mutation. */
  onChanged: () => void
}

type BankCurrency = 'USD' | 'EUR'

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

const MAIN_PILL =
  'inline-block text-[9px] font-bold uppercase tracking-[0.06em] py-[2px] px-[7px] rounded-pill bg-accent-soft border border-accent-line text-accent flex-none'

function formFromAccount(acct: BankWireAccount): BankWireForm {
  return {
    currency: acct.currency === 'EUR' ? 'EUR' : 'USD',
    label: acct.label ?? '',
    holderName: acct.accountHolder ?? '',
    bankName: acct.bankName ?? '',
    bankAddress: acct.bankAddress ?? '',
    accountType: acct.accountType ?? '',
    routingNumber: acct.routingNumber ?? '',
    accountNumber: acct.accountNumber ?? '',
    swiftBic: acct.swiftBic ?? '',
    iban: acct.iban ?? '',
  }
}

/**
 * Bank wire payout accounts (USD/EUR variants) — live against
 * /payout-methods/banks (add / edit / delete / set-main).
 */
export default function BankWireCard({
  accounts,
  loadError,
  onChanged,
}: BankWireCardProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<BankWireForm>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<BankWireAccount | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [mainBusyId, setMainBusyId] = useState<number | null>(null)

  const loaded = accounts !== null

  const setField =
    (key: keyof BankWireForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const openForm = (acct?: BankWireAccount) => {
    setForm(acct ? formFromAccount(acct) : EMPTY_FORM)
    setEditingId(acct ? acct.id : null)
    setError(null)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
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

    const input: BankInput = {
      label: form.label.trim() || form.holderName.trim(),
      accountHolder: form.holderName.trim(),
      bankName: form.bankName.trim(),
      bankAddress: form.bankAddress.trim() || undefined,
      accountType:
        form.currency === 'USD' && form.accountType ? form.accountType : undefined,
      routingNumber:
        form.currency === 'USD' && form.routingNumber.trim()
          ? form.routingNumber.trim()
          : undefined,
      accountNumber:
        form.currency === 'USD' && form.accountNumber.trim()
          ? form.accountNumber.trim()
          : undefined,
      swiftBic: form.swiftBic.trim() || undefined,
      iban: form.currency === 'EUR' && form.iban.trim() ? form.iban.trim() : undefined,
      currency: form.currency,
    }

    setBusy(true)
    setError(null)
    try {
      if (editingId !== null) await updateBank(editingId, input)
      else await addBank(input)
      closeForm()
      onChanged()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the bank account.'))
    } finally {
      setBusy(false)
    }
  }

  const handleSetMain = async (acct: BankWireAccount) => {
    if (acct.isMain || mainBusyId !== null) return
    setMainBusyId(acct.id)
    setError(null)
    try {
      await setMainPayoutMethod('bank', acct.id)
      onChanged()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not update the main account.'))
    } finally {
      setMainBusyId(null)
    }
  }

  const handleDelete = async () => {
    if (!toDelete || deleteBusy) return
    setDeleteBusy(true)
    setError(null)
    try {
      await deleteBank(toDelete.id)
      setToDelete(null)
      onChanged()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not delete the bank account.'))
      setToDelete(null)
    } finally {
      setDeleteBusy(false)
    }
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
        {!showForm && loaded && !loadError && (
          <button type="button" className={BTN_PRIMARY_SM} onClick={() => openForm()}>
            <Plus size={13} />
            Add Account
          </button>
        )}
      </div>

      {error && !showForm && (
        <div className={notice('error')} role="alert">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {loadError && (
        <div className={notice('error')} role="alert">
          <AlertCircle size={15} />
          <span>{loadError}</span>
        </div>
      )}

      {!loaded && !loadError && <p className={LOADING}>Loading bank accounts…</p>}

      {loaded && accounts.length > 0 && (
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
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[13px] font-bold min-w-0">
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                        {acct.label || acct.accountHolder || 'Bank account'}
                      </span>
                      {acct.isMain && <span className={MAIN_PILL}>Main</span>}
                    </p>
                    <p className="font-mono text-[10.5px] tracking-[0.08em] uppercase text-accent mt-0.5">
                      {acct.currency} · {acct.bankName ?? '—'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-0.5 flex-none">
                  <button
                    type="button"
                    className={ICON_BTN}
                    onClick={() => void handleSetMain(acct)}
                    disabled={mainBusyId !== null}
                    title={acct.isMain ? 'Main payout method' : 'Set as main'}
                    aria-label={
                      acct.isMain ? 'Main payout method' : 'Set as main account'
                    }
                  >
                    <Star
                      size={14}
                      className={acct.isMain ? 'text-accent' : undefined}
                      fill={acct.isMain ? 'currentColor' : 'none'}
                    />
                  </button>
                  <button
                    type="button"
                    className={ICON_BTN}
                    onClick={() => openForm(acct)}
                    title="Edit account"
                    aria-label="Edit account"
                  >
                    <Pencil size={14} />
                  </button>
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
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 mt-2.5 text-[12px]">
                <span className="text-faint">Account holder</span>
                <span className="font-semibold [overflow-wrap:anywhere]">
                  {acct.accountHolder ?? '—'}
                </span>
                {acct.iban && (
                  <>
                    <span className="text-faint">IBAN</span>
                    <span className="font-mono font-semibold [overflow-wrap:anywhere]">
                      {acct.iban}
                    </span>
                  </>
                )}
                {acct.accountNumber && (
                  <>
                    <span className="text-faint">Account #</span>
                    <span className="font-mono font-semibold [overflow-wrap:anywhere]">
                      {acct.accountNumber}
                    </span>
                  </>
                )}
                {acct.routingNumber && (
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
          onSubmit={(e) => void handleSubmit(e)}
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
                disabled={busy}
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
                disabled={busy}
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
                disabled={busy}
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
                disabled={busy}
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
                    disabled={busy}
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
                    disabled={busy}
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
                    disabled={busy}
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
                    disabled={busy}
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
                    disabled={busy}
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
                    disabled={busy}
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
                disabled={busy}
              />
            </div>
          </div>
          <div className={FORM_ACTIONS_ACCENT}>
            <button type="button" className={BTN_GHOST_SM} onClick={closeForm}>
              Cancel
            </button>
            <button type="submit" className={BTN_PRIMARY_SM} disabled={busy}>
              <Save size={13} />
              {busy
                ? 'Saving…'
                : editingId !== null
                  ? 'Update Account'
                  : 'Save Account'}
            </button>
          </div>
        </form>
      )}

      {loaded && accounts.length === 0 && !showForm && !loadError && (
        <p className={EMPTY}>
          No bank wire accounts yet. Click "Add Account" to add one.
        </p>
      )}

      <ConfirmModal
        open={toDelete !== null}
        title="Delete bank wire account?"
        message={
          toDelete
            ? `"${toDelete.label || toDelete.accountHolder || 'Bank account'}" (${toDelete.currency} · ${toDelete.bankName ?? '—'}) will be removed from your payout options.`
            : undefined
        }
        confirmLabel={deleteBusy ? 'Deleting…' : 'Yes, delete'}
        cancelLabel="No"
        danger
        onConfirm={() => void handleDelete()}
        onCancel={() => setToDelete(null)}
      />
    </section>
  )
}

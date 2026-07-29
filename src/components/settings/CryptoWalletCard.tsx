import { useState } from 'react'
import {
  AlertCircle,
  Check,
  Copy,
  Pencil,
  Plus,
  Save,
  Star,
  Trash2,
  Wallet,
} from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import { USDT_TRC20_NETWORK, isValidTRC20Address } from '../../lib/validators'
import {
  addWallet,
  deleteWallet,
  setMainPayoutMethod,
  updateWallet,
} from '../../services/payoutMethods'
import { getApiErrorMessage } from '../../services/api'
import { truncateAddress } from '../../lib/referrals'
import {
  BTN_GHOST_SM,
  BTN_PRIMARY_SM,
  CARD,
  CARD_HEAD,
  CARD_SUB,
  CARD_TITLE,
  CARD_TITLES,
  CHIP,
  FIELD,
  FORM,
  FORM_ACTIONS,
  HINT,
  ICON_BTN,
  ICON_BTN_DANGER,
  INPUT,
  INPUT_MONO,
  LABEL,
  LOADING,
  SELECT,
  notice,
} from './formClasses'
import type { CryptoWallet } from '../../types/referrals'

interface CryptoWalletCardProps {
  /** null while payout methods are loading (or failed — see loadError). */
  wallets: CryptoWallet[] | null
  loadError: string | null
  /** Refetch payout methods after any mutation. */
  onChanged: () => void
}

const MAIN_PILL =
  'inline-block text-[9px] font-bold uppercase tracking-[0.06em] py-[2px] px-[7px] rounded-pill bg-accent-soft border border-accent-line text-accent flex-none'

/**
 * USDT TRC20 payout wallets — live against /payout-methods
 * (add / edit / delete / copy / set-main).
 */
export default function CryptoWalletCard({
  wallets,
  loadError,
  onChanged,
}: CryptoWalletCardProps) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<CryptoWallet | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [mainBusyId, setMainBusyId] = useState<number | null>(null)

  const loaded = wallets !== null
  const showForm =
    loaded && (adding || editingId !== null || wallets.length === 0)
  const trimmedAddress = address.trim()
  const canSubmit =
    !busy &&
    name.trim() !== '' &&
    trimmedAddress !== '' &&
    isValidTRC20Address(trimmedAddress)

  const resetForm = () => {
    setAdding(false)
    setEditingId(null)
    setName('')
    setAddress('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    const input = {
      network: USDT_TRC20_NETWORK,
      address: trimmedAddress,
      name: name.trim(),
    }
    try {
      if (editingId !== null) await updateWallet(editingId, input)
      else await addWallet(input)
      resetForm()
      onChanged()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the wallet.'))
    } finally {
      setBusy(false)
    }
  }

  const handleEdit = (wallet: CryptoWallet) => {
    setEditingId(wallet.id)
    setAdding(false)
    setName(wallet.name)
    setAddress(wallet.address)
    setError(null)
  }

  const handleCopy = (wallet: CryptoWallet) => {
    void navigator.clipboard.writeText(wallet.address)
    setCopiedId(wallet.id)
    window.setTimeout(() => {
      setCopiedId((current) => (current === wallet.id ? null : current))
    }, 1600)
  }

  const handleSetMain = async (wallet: CryptoWallet) => {
    if (wallet.isMain || mainBusyId !== null) return
    setMainBusyId(wallet.id)
    setError(null)
    try {
      await setMainPayoutMethod('wallet', wallet.id)
      onChanged()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not update the main wallet.'))
    } finally {
      setMainBusyId(null)
    }
  }

  const handleDelete = async () => {
    if (!toDelete || deleteBusy) return
    setDeleteBusy(true)
    setError(null)
    try {
      await deleteWallet(toDelete.id)
      setToDelete(null)
      onChanged()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not delete the wallet.'))
      setToDelete(null)
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <section className={`${CARD} flex flex-col`} data-aos="fade-up" data-aos-delay="100">
      <div className={CARD_HEAD}>
        <span className={CHIP}>
          <Wallet size={15} />
        </span>
        <div className={CARD_TITLES}>
          <h3 className={CARD_TITLE}>USDT (TRC20) Wallet</h3>
          <p className={CARD_SUB}>
            Payout address for profits and referrals (Tron network only)
          </p>
        </div>
        {loaded && wallets.length > 0 && !showForm && (
          <button
            type="button"
            className={ICON_BTN}
            onClick={() => {
              setAdding(true)
              setError(null)
            }}
            title="Add wallet"
            aria-label="Add wallet"
          >
            <Plus size={15} />
          </button>
        )}
      </div>

      {error && (
        <div className={notice('error')} role="alert">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {loadError ? (
        <div className={notice('error')} role="alert">
          <AlertCircle size={15} />
          <span>{loadError}</span>
        </div>
      ) : !loaded ? (
        <p className={LOADING}>Loading wallets…</p>
      ) : !showForm ? (
        <div className="flex flex-col gap-2.5">
          {wallets.map((wallet) => (
            <div
              className="flex flex-col gap-2.5 p-3 border border-border rounded-row bg-surface2 transition-[border-color] duration-150 hover:border-accent-line"
              key={wallet.id}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={CHIP}>
                    <Wallet size={14} />
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[13px] font-bold min-w-0">
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                        {wallet.name}
                      </span>
                      {wallet.isMain && <span className={MAIN_PILL}>Main</span>}
                    </p>
                    <p className="font-mono text-[10.5px] tracking-[0.08em] uppercase text-accent mt-0.5">
                      {wallet.network}
                    </p>
                  </div>
                </div>
                <div className="flex gap-0.5 flex-none">
                  <button
                    type="button"
                    className={ICON_BTN}
                    onClick={() => void handleSetMain(wallet)}
                    disabled={mainBusyId !== null}
                    title={wallet.isMain ? 'Main payout method' : 'Set as main'}
                    aria-label={
                      wallet.isMain ? 'Main payout method' : 'Set as main wallet'
                    }
                  >
                    <Star
                      size={14}
                      className={wallet.isMain ? 'text-accent' : undefined}
                      fill={wallet.isMain ? 'currentColor' : 'none'}
                    />
                  </button>
                  <button
                    type="button"
                    className={ICON_BTN}
                    onClick={() => handleEdit(wallet)}
                    title="Edit wallet"
                    aria-label="Edit wallet"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className={ICON_BTN_DANGER}
                    onClick={() => setToDelete(wallet)}
                    title="Delete wallet"
                    aria-label="Delete wallet"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 py-1.5 px-2 border border-hair rounded-btn bg-surface">
                <span className="flex-1 min-w-0 font-mono text-[12px] text-muted [overflow-wrap:anywhere]">
                  {truncateAddress(wallet.address, 14, 12)}
                </span>
                <button
                  type="button"
                  className={ICON_BTN}
                  onClick={() => handleCopy(wallet)}
                  title="Copy address"
                  aria-label="Copy address"
                >
                  {copiedId === wallet.id ? (
                    <Check size={14} className="text-green" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <form className={FORM} onSubmit={(e) => void handleSubmit(e)}>
          <div className={FIELD}>
            <label className={LABEL} htmlFor="wallet-name">
              Wallet Name *
            </label>
            <input
              id="wallet-name"
              className={INPUT}
              type="text"
              placeholder="e.g. Main USDT wallet"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className={FIELD}>
            <label className={LABEL} htmlFor="wallet-network">
              Network
            </label>
            <select id="wallet-network" className={SELECT} value={USDT_TRC20_NETWORK} disabled>
              <option value={USDT_TRC20_NETWORK}>{USDT_TRC20_NETWORK}</option>
            </select>
            <p className={HINT}>
              Only USDT TRC20 (Tron) is supported for payouts.
            </p>
          </div>
          <div className={FIELD}>
            <label className={LABEL} htmlFor="wallet-address">
              USDT TRC20 Address *
            </label>
            <input
              id="wallet-address"
              className={INPUT_MONO}
              type="text"
              placeholder="T… (Tron TRC20 address, 34 characters)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={busy}
            />
            <p className={HINT}>
              Address starts with T and is 34 characters long.
            </p>
          </div>
          <div className={FORM_ACTIONS}>
            {(editingId !== null || adding) && (
              <button
                type="button"
                className={BTN_GHOST_SM}
                onClick={resetForm}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className={BTN_PRIMARY_SM}
              disabled={!canSubmit}
            >
              {editingId !== null ? <Save size={13} /> : <Wallet size={13} />}
              {busy
                ? 'Saving…'
                : editingId !== null
                  ? 'Update Wallet'
                  : 'Add Wallet'}
            </button>
          </div>
        </form>
      )}

      <ConfirmModal
        open={toDelete !== null}
        title="Delete payout wallet?"
        message={
          toDelete
            ? `"${toDelete.name}" (${truncateAddress(toDelete.address, 14, 12)}) will be removed from your payout options.`
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

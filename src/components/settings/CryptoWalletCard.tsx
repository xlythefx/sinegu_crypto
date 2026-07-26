import { useState } from 'react'
import { Check, Copy, Pencil, Save, Trash2, Wallet } from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import { USDT_TRC20_NETWORK, isValidTRC20Address } from '../../lib/validators'
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
  SELECT,
} from './formClasses'
import { PAYOUT_WALLETS, type PayoutWallet } from './mockData'

function truncateAddress(address: string): string {
  return address.length > 28
    ? `${address.slice(0, 14)}…${address.slice(-12)}`
    : address
}

/**
 * USDT TRC20 payout wallets — add/edit/delete/copy in local state.
 * Static prototype data — wired to the API once payout endpoints exist.
 */
export default function CryptoWalletCard() {
  const [wallets, setWallets] = useState<PayoutWallet[]>(PAYOUT_WALLETS)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [toDelete, setToDelete] = useState<PayoutWallet | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const showForm = wallets.length === 0 || editingId !== null
  const trimmedAddress = address.trim()
  const canSubmit =
    name.trim() !== '' && trimmedAddress !== '' && isValidTRC20Address(trimmedAddress)

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setAddress('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    if (editingId) {
      setWallets((prev) =>
        prev.map((w) =>
          w.id === editingId
            ? { ...w, name: name.trim(), address: trimmedAddress }
            : w,
        ),
      )
    } else {
      setWallets((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: name.trim(),
          network: USDT_TRC20_NETWORK,
          address: trimmedAddress,
        },
      ])
    }
    resetForm()
  }

  const handleEdit = (wallet: PayoutWallet) => {
    setEditingId(wallet.id)
    setName(wallet.name)
    setAddress(wallet.address)
  }

  const handleCopy = (wallet: PayoutWallet) => {
    navigator.clipboard.writeText(wallet.address)
    setCopiedId(wallet.id)
    window.setTimeout(() => {
      setCopiedId((current) => (current === wallet.id ? null : current))
    }, 1600)
  }

  return (
    <section className={`${CARD} flex flex-col`} data-aos="fade-up" data-aos-delay="200">
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
      </div>

      {!showForm ? (
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
                    <p className="text-[13px] font-bold overflow-hidden text-ellipsis whitespace-nowrap">
                      {wallet.name}
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
                  {truncateAddress(wallet.address)}
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
        <form className={FORM} onSubmit={handleSubmit}>
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
            />
            <p className={HINT}>
              Address starts with T and is 34 characters long.
            </p>
          </div>
          <div className={FORM_ACTIONS}>
            {editingId && (
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
              {editingId ? <Save size={13} /> : <Wallet size={13} />}
              {editingId ? 'Update Wallet' : 'Add Wallet'}
            </button>
          </div>
        </form>
      )}

      <ConfirmModal
        open={toDelete !== null}
        title="Delete payout wallet?"
        message={
          toDelete
            ? `"${toDelete.name}" (${truncateAddress(toDelete.address)}) will be removed from your payout options.`
            : undefined
        }
        confirmLabel="Yes, delete"
        cancelLabel="No"
        danger
        onConfirm={() => {
          setWallets((prev) => prev.filter((w) => w.id !== toDelete?.id))
          setToDelete(null)
        }}
        onCancel={() => setToDelete(null)}
      />
    </section>
  )
}

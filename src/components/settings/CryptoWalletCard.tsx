import { useState } from 'react'
import { Check, Copy, Pencil, Save, Trash2, Wallet } from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import { USDT_TRC20_NETWORK, isValidTRC20Address } from '../../lib/validators'
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
    <section className="dcard set-card" data-aos="fade-up" data-aos-delay="200">
      <div className="dcard__title-row set-card__head">
        <span className="dchip">
          <Wallet size={15} />
        </span>
        <div className="set-card__titles">
          <h3 className="dcard__title">USDT (TRC20) Wallet</h3>
          <p className="dcard__sub">
            Payout address for profits and referrals (Tron network only)
          </p>
        </div>
      </div>

      {!showForm ? (
        <div className="scw__list">
          {wallets.map((wallet) => (
            <div className="scw__item" key={wallet.id}>
              <div className="scw__item-head">
                <div className="scw__item-id">
                  <span className="dchip">
                    <Wallet size={14} />
                  </span>
                  <div className="scw__item-meta">
                    <p className="scw__item-name">{wallet.name}</p>
                    <p className="scw__item-net mono">{wallet.network}</p>
                  </div>
                </div>
                <div className="scw__item-actions">
                  <button
                    type="button"
                    className="sicon-btn"
                    onClick={() => handleEdit(wallet)}
                    title="Edit wallet"
                    aria-label="Edit wallet"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="sicon-btn sicon-btn--danger"
                    onClick={() => setToDelete(wallet)}
                    title="Delete wallet"
                    aria-label="Delete wallet"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="scw__addr">
                <span className="scw__addr-text mono">
                  {truncateAddress(wallet.address)}
                </span>
                <button
                  type="button"
                  className="sicon-btn"
                  onClick={() => handleCopy(wallet)}
                  title="Copy address"
                  aria-label="Copy address"
                >
                  {copiedId === wallet.id ? (
                    <Check size={14} className="scw__copied" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <form className="set-form" onSubmit={handleSubmit}>
          <div className="sfield">
            <label className="sfield__label" htmlFor="wallet-name">
              Wallet Name *
            </label>
            <input
              id="wallet-name"
              className="sinput"
              type="text"
              placeholder="e.g. Main USDT wallet"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="sfield">
            <label className="sfield__label" htmlFor="wallet-network">
              Network
            </label>
            <select id="wallet-network" className="sinput" value={USDT_TRC20_NETWORK} disabled>
              <option value={USDT_TRC20_NETWORK}>{USDT_TRC20_NETWORK}</option>
            </select>
            <p className="sfield__hint">
              Only USDT TRC20 (Tron) is supported for payouts.
            </p>
          </div>
          <div className="sfield">
            <label className="sfield__label" htmlFor="wallet-address">
              USDT TRC20 Address *
            </label>
            <input
              id="wallet-address"
              className="sinput sinput--mono"
              type="text"
              placeholder="T… (Tron TRC20 address, 34 characters)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <p className="sfield__hint">
              Address starts with T and is 34 characters long.
            </p>
          </div>
          <div className="set-form__actions">
            {editingId && (
              <button
                type="button"
                className="sbtn sbtn--ghost sbtn--sm"
                onClick={resetForm}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="sbtn sbtn--primary sbtn--sm"
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

import { useCallback, useEffect, useState } from 'react'
import ConfirmModal from '../ui/ConfirmModal'
import KeyBlockedModal from '../exchanges/KeyBlockedModal'
import {
  deleteExchangeAccount,
  getExchangeAccountsWithMeta,
  refreshAccountBalance,
} from '../../services/exchanges'
import type { ExchangeAccount } from '../../types/exchanges'

/**
 * Raises the "your API key is being refused" modal on the dashboard, because
 * that is the page people actually land on — an account that takes no trades
 * must not wait to be noticed on a settings screen.
 *
 * Dismissible per session, not permanently: the account is on a clock (it gets
 * disconnected once the grace period runs out), so the warning has to come
 * back on the next visit if it is still broken. Silence would be the same
 * failure this whole feature exists to end.
 */
export default function KeyBlockedGate() {
  const [account, setAccount] = useState<ExchangeAccount | null>(null)
  const [serverIp, setServerIp] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  useEffect(() => {
    let cancelled = false
    getExchangeAccountsWithMeta()
      .then(({ accounts, serverIp: ip }) => {
        if (cancelled) return
        const blocked = accounts.find((a) => a.key_status === 'blocked')
        if (!blocked) return
        setAccount(blocked)
        setServerIp(ip)
        setOpen(true)
      })
      .catch(() => {
        // A dashboard must still render if this lookup fails — the Exchange
        // Accounts page carries the same warning on the card itself.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const recheck = useCallback(async () => {
    if (!account) return
    try {
      const { account: fresh } = await refreshAccountBalance(account.id)
      setAccount(fresh)
      // Fixed: the exchange answered, so the flag is gone — close and get out
      // of the way rather than making them dismiss a solved problem.
      if (fresh.key_status !== 'blocked') setOpen(false)
    } catch {
      /* still broken, or rate-limited — the modal stays with its detail */
    }
  }, [account])

  const disconnect = useCallback(async () => {
    if (!account) return
    try {
      await deleteExchangeAccount(account.id)
    } finally {
      setConfirmDisconnect(false)
      setOpen(false)
      // Reload so the dashboard reflects having no connected exchange.
      window.location.reload()
    }
  }, [account])

  if (!account) return null

  return (
    <>
      <KeyBlockedModal
        open={open && !confirmDisconnect}
        account={account}
        serverIp={serverIp}
        onClose={() => setOpen(false)}
        onRecheck={recheck}
        onDisconnect={() => setConfirmDisconnect(true)}
      />
      <ConfirmModal
        open={confirmDisconnect}
        title={`Disconnect ${account.name}?`}
        message="Your API keys are removed and the bot stops using this account. You can connect a new key straight away."
        confirmLabel="Disconnect"
        cancelLabel="Keep it"
        danger
        onConfirm={disconnect}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </>
  )
}

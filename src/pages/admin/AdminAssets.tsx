import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import AssetFormModal from '../../components/admin/AssetFormModal'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { useApiData } from '../../hooks/useApiData'
import {
  createAsset,
  deleteAsset,
  getAdminAssets,
  updateAsset,
  type AssetImageChange,
} from '../../services/admin'
import { getApiErrorMessage } from '../../services/api'
import { displaySymbol } from '../../lib/chart'
import { fmtMediumDate, fmtQty } from '../../lib/format'
import type { AdminAsset, AssetInput } from '../../types/admin'

const PAGE_SIZE = 10

/* ---- shared class strings (were the .aassets-* rules in AdminAssets.css) ---- */
const INPUT =
  'h-[38px] rounded-field border border-border bg-surface2 px-3 text-[13px] text-text outline-none focus:border-accent [&>option]:bg-surface [&>option]:text-text'
const ICON_BTN_BASE =
  'inline-flex items-center justify-center w-[30px] h-[30px] rounded-btn border border-border bg-surface2 text-muted transition-[border-color,color] duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
const ICON_BTN = `${ICON_BTN_BASE} hover:border-accent hover:text-text`
const ICON_BTN_DANGER = `${ICON_BTN_BASE} hover:border-red hover:text-red`
const TH =
  'border-b border-border py-2.5 px-3 text-left font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint whitespace-nowrap'
const TH_RIGHT = `${TH} text-right`
const TD = 'border-b border-hair py-[11px] px-3 align-middle whitespace-nowrap'
const TD_NUM = `${TD} text-right font-mono`
const TD_META = `${TD} text-[12.5px] text-muted`
const PAG_BTN =
  'rounded-pill border border-border bg-surface2 py-[7px] px-[15px] text-[12.5px] font-semibold text-text hover:border-accent disabled:opacity-45 disabled:cursor-not-allowed'
const TOGGLE_BASE =
  'relative mr-2 inline-block w-9 h-5 rounded-pill border align-middle transition-[background,border-color] duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
const KNOB_BASE =
  'absolute left-0.5 top-0.5 w-[14px] h-[14px] rounded-full transition-[transform,background] duration-150'

const SIDE_TONE: Record<AdminAsset['side'], string> = {
  LONG: 'text-green border-[color-mix(in_srgb,var(--green)_35%,transparent)] bg-[color-mix(in_srgb,var(--green)_8%,transparent)]',
  SHORT:
    'text-red border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)]',
  ALL: 'text-muted border-border',
}

function SideBadge({ side }: { side: AdminAsset['side'] }) {
  return (
    <span
      className={`rounded-pill border px-2.5 py-[3px] font-mono text-[10.5px] font-semibold tracking-[0.06em] ${SIDE_TONE[side]}`}
    >
      {side}
    </span>
  )
}

export default function AdminAssets() {
  const { data: assets, loading, error, reload } = useApiData(getAdminAssets)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [tickerFilter, setTickerFilter] = useState('all')
  const [page, setPage] = useState(1)

  // create/edit modal
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AdminAsset | null>(null)
  const [pending, setPending] = useState<
    { input: AssetInput; image: AssetImageChange } | null
  >(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // toggle + delete confirmations
  const [toggling, setToggling] = useState<AdminAsset | null>(null)
  const [deleting, setDeleting] = useState<AdminAsset | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const list = useMemo(() => assets ?? [], [assets])

  const types = useMemo(
    () =>
      Array.from(
        new Set(list.map((a) => (a.type ?? '').trim()).filter(Boolean))
      ).sort(),
    [list]
  )
  const tickers = useMemo(
    () => Array.from(new Set(list.map((a) => a.ticker))).sort(),
    [list]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return list.filter((a) => {
      const matchesSearch =
        !q ||
        a.ticker.toLowerCase().includes(q) ||
        (a.type ?? '').toLowerCase().includes(q) ||
        (a.broker ?? '').toLowerCase().includes(q)
      const matchesType = typeFilter === 'all' || (a.type ?? '') === typeFilter
      const matchesTicker = tickerFilter === 'all' || a.ticker === tickerFilter
      return matchesSearch && matchesType && matchesTicker
    })
  }, [list, search, typeFilter, tickerFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const pageRows = filtered.slice(start, start + PAGE_SIZE)

  const resetToFirstPage = () => setPage(1)

  const openCreate = () => {
    setEditing(null)
    setFormError(null)
    setFormOpen(true)
  }

  const openEdit = (asset: AdminAsset) => {
    setEditing(asset)
    setFormError(null)
    setFormOpen(true)
  }

  /** Step 1: form submit → hold input + image and ask for confirmation. */
  const onFormSubmit = (input: AssetInput, image: AssetImageChange) => {
    setPending({ input, image })
  }

  /** Step 2: confirmed → hit the API (multipart, with the optional image). */
  const onConfirmSave = async () => {
    if (!pending) return
    setSaving(true)
    setFormError(null)
    try {
      if (editing) {
        await updateAsset(editing.asset_id, pending.input, pending.image)
      } else {
        await createAsset(pending.input, pending.image)
      }
      setPending(null)
      setFormOpen(false)
      setEditing(null)
      reload()
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Could not save the asset.'))
      setPending(null)
    } finally {
      setSaving(false)
    }
  }

  const onConfirmToggle = async () => {
    if (!toggling) return
    setActionBusy(true)
    setActionError(null)
    try {
      await updateAsset(toggling.asset_id, {
        ticker: toggling.ticker,
        type: toggling.type,
        broker: toggling.broker,
        side: toggling.side,
        max_increments: toggling.max_increments,
        base_size: toggling.base_size,
        enabled: !toggling.enabled,
      })
      setToggling(null)
      reload()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not update the asset.'))
      setToggling(null)
    } finally {
      setActionBusy(false)
    }
  }

  const onConfirmDelete = async () => {
    if (!deleting) return
    setActionBusy(true)
    setActionError(null)
    try {
      await deleteAsset(deleting.asset_id)
      setDeleting(null)
      reload()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not delete the asset.'))
      setDeleting(null)
    } finally {
      setActionBusy(false)
    }
  }

  if (!assets) {
    return (
      <AdminLayout title="Trading Assets" subtitle="Manage tradable instruments">
        <DataState
          loading={loading}
          error={error}
          onRetry={reload}
          label="assets"
        />
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Trading Assets" subtitle="Manage tradable instruments">
      <div
        className="rounded-card border border-border bg-surface p-card"
        data-aos="fade-up"
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3.5">
          <div>
            <div className="font-display text-[15px] font-extrabold">
              All Assets
            </div>
            <div className="mt-px text-[12px] text-muted">
              Showing {filtered.length === 0 ? 0 : start + 1}–
              {Math.min(start + PAGE_SIZE, filtered.length)} of{' '}
              {filtered.length} assets
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              className={`${INPUT} min-w-[190px]`}
              placeholder="Search by ticker, type…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                resetToFirstPage()
              }}
              aria-label="Search assets"
            />
            <select
              className={INPUT}
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value)
                resetToFirstPage()
              }}
              aria-label="Filter by type"
            >
              <option value="all">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              className={INPUT}
              value={tickerFilter}
              onChange={(e) => {
                setTickerFilter(e.target.value)
                resetToFirstPage()
              }}
              aria-label="Filter by ticker"
            >
              <option value="all">All tickers</option>
              {tickers.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="inline-flex h-[38px] items-center gap-1.5 rounded-pill bg-accent px-4 text-[13px] font-bold text-on-accent"
              onClick={openCreate}
            >
              <Plus size={15} />
              New Asset
            </button>
          </div>
        </div>

        {actionError && (
          <p
            className="mb-3 rounded-field border border-[color-mix(in_srgb,#ef4444_35%,transparent)] bg-[color-mix(in_srgb,#ef4444_8%,transparent)] py-2.5 px-3.5 text-[13px] text-[#ef4444]"
            role="alert"
          >
            {actionError}
          </p>
        )}

        <div
          key={`${typeFilter}-${tickerFilter}-${safePage}`}
          className="overflow-x-auto animate-[fadeup_0.35s_ease-out]"
        >
          <table className="w-full min-w-[880px] border-collapse text-[13.5px]">
            <thead>
              <tr>
                {['Ticker', 'Broker', 'Side'].map((h) => (
                  <th key={h} className={TH}>
                    {h}
                  </th>
                ))}
                <th className={TH_RIGHT}>Max Position Size</th>
                <th className={TH_RIGHT}>Base Size</th>
                {['Status', 'Created', 'Updated'].map((h) => (
                  <th key={h} className={TH}>
                    {h}
                  </th>
                ))}
                <th className={TH_RIGHT}>Actions</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child_td]:border-0">
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-9 px-3 text-center text-muted">
                    No assets match your search. Adjust the filters or create a
                    new asset.
                  </td>
                </tr>
              )}
              {pageRows.map((asset) => (
                <tr key={asset.asset_id} className="hover:bg-surface2">
                  <td className={TD}>
                    <div className="flex items-center gap-2.5">
                      {asset.asset_image ? (
                        <img
                          className="w-[26px] h-[26px] flex-none rounded-full object-cover border border-border bg-surface2"
                          src={asset.asset_image}
                          alt=""
                        />
                      ) : (
                        <span className="inline-flex items-center justify-center w-[26px] h-[26px] flex-none rounded-full bg-accent-soft font-mono text-[12px] font-bold text-accent">
                          {asset.ticker[0]}
                        </span>
                      )}
                      <span className="font-mono font-bold">
                        {displaySymbol(asset.ticker)}
                      </span>
                    </div>
                  </td>
                  <td className={TD}>{asset.broker ?? '—'}</td>
                  <td className={TD}>
                    <SideBadge side={asset.side} />
                  </td>
                  <td className={TD_NUM}>{fmtQty(asset.max_increments)}</td>
                  <td className={TD_NUM}>{fmtQty(asset.base_size)}</td>
                  <td className={TD}>
                    <button
                      type="button"
                      className={`${TOGGLE_BASE} ${asset.enabled ? 'border-accent bg-accent-soft' : 'border-border bg-surface2'}`}
                      onClick={() => setToggling(asset)}
                      disabled={actionBusy}
                      aria-label={`${asset.enabled ? 'Disable' : 'Enable'} ${asset.ticker}`}
                    >
                      <span
                        className={`${KNOB_BASE} ${asset.enabled ? 'translate-x-4 bg-accent' : 'bg-muted'}`}
                      />
                    </button>
                    <span
                      className={`text-[12px] ${asset.enabled ? 'text-green' : 'text-muted'}`}
                    >
                      {asset.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className={TD_META}>
                    {asset.created_at ? fmtMediumDate(asset.created_at) : '—'}
                  </td>
                  <td className={TD_META}>
                    {asset.updated_at ? fmtMediumDate(asset.updated_at) : '—'}
                  </td>
                  <td className={`${TD} text-right`}>
                    <div className="inline-flex gap-1.5">
                      <button
                        type="button"
                        className={ICON_BTN}
                        onClick={() => openEdit(asset)}
                        disabled={actionBusy}
                        aria-label={`Edit ${asset.ticker}`}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className={ICON_BTN_DANGER}
                        onClick={() => setDeleting(asset)}
                        disabled={actionBusy}
                        aria-label={`Delete ${asset.ticker}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && totalPages > 1 && (
          <div className="mt-3.5 flex items-center justify-between border-t border-hair pt-3">
            <span className="text-[12.5px] text-muted">
              Page {safePage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className={PAG_BTN}
                disabled={safePage === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className={PAG_BTN}
                disabled={safePage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <AssetFormModal
        open={formOpen}
        asset={editing}
        saving={saving}
        error={formError}
        onSubmit={onFormSubmit}
        onCancel={() => {
          setFormOpen(false)
          setEditing(null)
        }}
      />

      <ConfirmModal
        open={pending !== null}
        title={editing ? 'Save changes?' : 'Create asset?'}
        message={
          editing
            ? 'This will update the asset in the database.'
            : 'This will add a new asset to the database.'
        }
        confirmLabel={editing ? 'Yes, save' : 'Yes, create'}
        cancelLabel="No"
        onConfirm={onConfirmSave}
        onCancel={() => setPending(null)}
      />

      <ConfirmModal
        open={toggling !== null}
        title={`${toggling?.enabled ? 'Disable' : 'Enable'} ${toggling?.ticker}?`}
        message={
          toggling?.enabled
            ? 'The bots will stop trading this asset.'
            : 'The bots will be allowed to trade this asset again.'
        }
        confirmLabel={toggling?.enabled ? 'Yes, disable' : 'Yes, enable'}
        cancelLabel="No"
        danger={toggling?.enabled ?? false}
        onConfirm={onConfirmToggle}
        onCancel={() => setToggling(null)}
      />

      <ConfirmModal
        open={deleting !== null}
        title={`Delete ${deleting?.ticker}?`}
        message="This action cannot be undone. The asset will be permanently removed."
        confirmLabel="Yes, delete"
        cancelLabel="No"
        danger
        onConfirm={onConfirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </AdminLayout>
  )
}

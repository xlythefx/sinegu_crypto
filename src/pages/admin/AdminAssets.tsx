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
import './AdminAssets.css'

const PAGE_SIZE = 10

function SideBadge({ side }: { side: AdminAsset['side'] }) {
  return (
    <span className={`aassets-side aassets-side--${side.toLowerCase()}`}>
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
      <div className="aassets-card" data-aos="fade-up">
        <div className="aassets-head">
          <div>
            <div className="aassets-head__title">All Assets</div>
            <div className="aassets-head__sub">
              Showing {filtered.length === 0 ? 0 : start + 1}–
              {Math.min(start + PAGE_SIZE, filtered.length)} of{' '}
              {filtered.length} assets
            </div>
          </div>
          <div className="aassets-controls">
            <input
              type="search"
              className="aassets-input aassets-input--search"
              placeholder="Search by ticker, type…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                resetToFirstPage()
              }}
              aria-label="Search assets"
            />
            <select
              className="aassets-input"
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
              className="aassets-input"
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
              className="aassets-new-btn"
              onClick={openCreate}
            >
              <Plus size={15} />
              New Asset
            </button>
          </div>
        </div>

        {actionError && (
          <p className="aassets-error" role="alert">
            {actionError}
          </p>
        )}

        <div className="aassets-table-wrap">
          <table className="aassets-table">
            <thead>
              <tr>
                {['Ticker', 'Broker', 'Side'].map((h) => (
                  <th key={h} className="aassets-th">
                    {h}
                  </th>
                ))}
                <th className="aassets-th aassets-th--right">
                  Max Position Size
                </th>
                <th className="aassets-th aassets-th--right">
                  Base Size
                </th>
                {['Status', 'Created', 'Updated'].map((h) => (
                  <th key={h} className="aassets-th">
                    {h}
                  </th>
                ))}
                <th className="aassets-th aassets-th--right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="aassets-tbody">
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="aassets-empty">
                    No assets match your search. Adjust the filters or create a
                    new asset.
                  </td>
                </tr>
              )}
              {pageRows.map((asset) => (
                <tr key={asset.asset_id}>
                  <td className="aassets-td">
                    <div className="aassets-ticker">
                      {asset.asset_image ? (
                        <img
                          className="aassets-ticker__img"
                          src={asset.asset_image}
                          alt=""
                        />
                      ) : (
                        <span className="aassets-ticker__icon">
                          {asset.ticker[0]}
                        </span>
                      )}
                      <span className="aassets-ticker__sym">
                        {displaySymbol(asset.ticker)}
                      </span>
                    </div>
                  </td>
                  <td className="aassets-td">{asset.broker ?? '—'}</td>
                  <td className="aassets-td">
                    <SideBadge side={asset.side} />
                  </td>
                  <td className="aassets-td aassets-td--num">
                    {fmtQty(asset.max_increments)}
                  </td>
                  <td className="aassets-td aassets-td--num">
                    {fmtQty(asset.base_size)}
                  </td>
                  <td className="aassets-td">
                    <button
                      type="button"
                      className={`aassets-toggle${asset.enabled ? ' aassets-toggle--on' : ''}`}
                      onClick={() => setToggling(asset)}
                      disabled={actionBusy}
                      aria-label={`${asset.enabled ? 'Disable' : 'Enable'} ${asset.ticker}`}
                    >
                      <span
                        className={`aassets-toggle__knob${asset.enabled ? ' aassets-toggle__knob--on' : ''}`}
                      />
                    </button>
                    <span className={`aassets-status-text${asset.enabled ? ' aassets-status-text--on' : ''}`}>
                      {asset.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="aassets-td aassets-td--meta">
                    {asset.created_at ? fmtMediumDate(asset.created_at) : '—'}
                  </td>
                  <td className="aassets-td aassets-td--meta">
                    {asset.updated_at ? fmtMediumDate(asset.updated_at) : '—'}
                  </td>
                  <td className="aassets-td aassets-td--actions">
                    <div className="aassets-actions">
                      <button
                        type="button"
                        className="aassets-icon-btn"
                        onClick={() => openEdit(asset)}
                        disabled={actionBusy}
                        aria-label={`Edit ${asset.ticker}`}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className="aassets-icon-btn aassets-icon-btn--danger"
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
          <div className="aassets-pag">
            <span className="aassets-pag__info">
              Page {safePage} of {totalPages}
            </span>
            <div className="aassets-pag__controls">
              <button
                type="button"
                className="aassets-pag__btn"
                disabled={safePage === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="aassets-pag__btn"
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

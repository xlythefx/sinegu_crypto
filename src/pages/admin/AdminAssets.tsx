import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Layers, Plus, TrendingUpDown } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import AssetCard from '../../components/admin/AssetCard'
import AssetFormModal from '../../components/admin/AssetFormModal'
import StreakSizingTab from '../../components/admin/assets/StreakSizingTab'
import ConfirmModal from '../../components/ui/ConfirmModal'
import Tabs, { type TabItem } from '../../components/ui/Tabs'
import { useApiData } from '../../hooks/useApiData'
import {
  createAsset,
  deleteAsset,
  getAdminAssets,
  updateAsset,
  type AssetImageChange,
} from '../../services/admin'
import { getApiErrorMessage } from '../../services/api'
import type { AdminAsset, AssetInput } from '../../types/admin'

/** 12 divides evenly by the 1/2/3-column grid, so no ragged last row. */
const PAGE_SIZE = 12

const INPUT =
  'h-[38px] rounded-field border border-border bg-surface2 px-3 text-[13px] text-text outline-none focus:border-accent [&>option]:bg-surface [&>option]:text-text'
const PAG_BTN =
  'rounded-pill border border-border bg-surface2 py-[7px] px-[15px] text-[12.5px] font-semibold text-text hover:border-accent disabled:opacity-45 disabled:cursor-not-allowed'

type AssetsTab = 'assets' | 'streak-sizing'

const TABS: TabItem<AssetsTab>[] = [
  { key: 'assets', label: 'Assets', Icon: Layers },
  { key: 'streak-sizing', label: 'Streak Sizing Settings', Icon: TrendingUpDown },
]

/**
 * `?tab=` values that open the streak tab. `loss-sizing` is its name from
 * before win steps existed — the owner's to-do link and bookmarks still
 * carry it, so it must keep landing here.
 */
const STREAK_TAB_PARAMS = new Set(['streak-sizing', 'loss-sizing'])

export default function AdminAssets() {
  const { data: assets, loading, error, reload } = useApiData(getAdminAssets)

  // The tab lives in `?tab=` so a link or a reload lands on the same one;
  // the default tab omits the param.
  const [params, setParams] = useSearchParams()
  const tab: AssetsTab = STREAK_TAB_PARAMS.has(params.get('tab') ?? '')
    ? 'streak-sizing'
    : 'assets'
  const selectTab = (next: AssetsTab) =>
    setParams(next === 'assets' ? {} : { tab: next }, { replace: true })
  const tabBar = (
    <div className="mb-stack">
      <Tabs tabs={TABS} active={tab} onChange={selectTab} label="Trading assets sections" />
    </div>
  )

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

  /** How many of the matched assets the bot may actually trade right now. */
  const enabledCount = useMemo(
    () => filtered.filter((a) => a.enabled).length,
    [filtered]
  )

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
        {tabBar}
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
      {tabBar}
      {/* keyed re-mount replays the reveal on every tab switch */}
      <div key={tab} className="animate-[fadeup_0.35s_ease-out]">
        {tab === 'streak-sizing' ? (
          <StreakSizingTab assets={list} onSaved={reload} />
        ) : (
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
                  <span className="text-faint">
                    {' · '}
                    {enabledCount} tradable, {filtered.length - enabledCount} off
                  </span>
                </div>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <input
                  type="search"
                  className={`${INPUT} min-w-0 flex-1 sm:min-w-[190px] sm:flex-none`}
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

            {/* Re-mounted on every filter/page change so the new set reveals
                instead of hard-cutting (project convention). */}
            <div
              key={`${search}-${typeFilter}-${tickerFilter}-${safePage}`}
              className="animate-[fadeup_0.35s_ease-out]"
            >
              {pageRows.length === 0 ? (
                <p className="rounded-card border border-dashed border-border bg-surface2 px-4 py-10 text-center text-[13px] text-muted">
                  No assets match your search. Adjust the filters or create a new
                  asset.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3.5 min-[560px]:grid-cols-2 min-[1180px]:grid-cols-3">
                  {pageRows.map((asset) => (
                    <AssetCard
                      key={asset.asset_id}
                      asset={asset}
                      busy={actionBusy}
                      onToggle={setToggling}
                      onEdit={openEdit}
                      onDelete={setDeleting}
                    />
                  ))}
                </div>
              )}
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

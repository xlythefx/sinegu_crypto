import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import AssetEditor from '../../components/admin/assets/editor/AssetEditor'
import DataState from '../../components/dashboard/DataState'
import { exchangeFromBroker } from '../../components/exchanges/meta'
import { useApiData } from '../../hooks/useApiData'
import { ASSET_BROKERS } from '../../lib/assetDraft'
import { createAsset, getAdminAssets, updateAsset } from '../../services/admin'

/** The list page, on the exchange a coin belongs to (or every exchange). */
function assetsListPath(broker: string | null | undefined): string {
  const kind = exchangeFromBroker(broker)
  return kind ? `/admin/assets?exchange=${kind}` : '/admin/assets'
}

/** `?broker=` of a "New coin" link, when it names a supported exchange. */
function brokerParam(raw: string | null): string | null {
  const kind = exchangeFromBroker(raw)
  return ASSET_BROKERS.find((b) => exchangeFromBroker(b) === kind) ?? null
}

/**
 * Admin → Trading Assets → New coin (`/admin/assets/new[?broker=MEXC]`) and
 * Edit coin (`/admin/assets/:assetId/edit`). Thin: loads the asset, mounts
 * the editor, writes through services/admin, and goes back to the list with a
 * "saved" note in the navigation state.
 */
export default function AdminAssetEditor() {
  const { assetId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const creating = assetId === undefined
  const defaultBroker = creating ? brokerParam(params.get('broker')) : null

  // The list is the only read the API offers; an edit picks its row out of it.
  const { data: assets, loading, error, reload } = useApiData(
    () => (creating ? Promise.resolve([]) : getAdminAssets()),
    [creating],
  )
  const asset = creating ? null : (assets?.find((a) => a.asset_id === Number(assetId)) ?? null)

  const title = creating ? 'New coin' : asset ? `Edit ${asset.ticker}` : 'Edit coin'

  let body
  if (!creating && !assets) {
    body = <DataState loading={loading} error={error} onRetry={reload} label="asset" />
  } else if (!creating && !asset) {
    body = (
      <div className="mx-auto max-w-[560px] rounded-card border border-dashed border-border bg-surface px-5 py-10 text-center">
        <p className="font-display text-[16px] font-extrabold">That coin no longer exists</p>
        <p className="mt-1.5 text-[13px] text-muted">It may have been deleted. Go back to the list to pick another.</p>
        <button
          type="button"
          onClick={() => navigate('/admin/assets')}
          className="mt-4 inline-flex h-11 cursor-pointer items-center rounded-pill bg-accent px-5 text-[13.5px] font-bold text-on-accent"
        >
          Back to Trading Assets
        </button>
      </div>
    )
  } else {
    body = (
      <AssetEditor
        key={asset?.asset_id ?? 'new'}
        asset={asset}
        defaultBroker={defaultBroker}
        onSave={async (input, image) => {
          if (asset) await updateAsset(asset.asset_id, input, image)
          else await createAsset(input, image)
          navigate(assetsListPath(input.broker), {
            state: { saved: `${input.ticker}${input.broker ? ` on ${input.broker}` : ''} ${asset ? 'saved' : 'created'}.` },
          })
        }}
        onLeave={() => navigate(assetsListPath(asset?.broker ?? defaultBroker))}
      />
    )
  }

  return (
    <AdminLayout title="Trading Assets" subtitle={title}>
      {body}
    </AdminLayout>
  )
}

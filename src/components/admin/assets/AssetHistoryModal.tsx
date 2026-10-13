import { History } from 'lucide-react'
import AssetHistoryList from './AssetHistoryList'
import HelperModal, { HELPER_BTN_SECONDARY } from './HelperModal'
import { displaySymbol } from '../../../lib/chart'
import type { AdminAsset } from '../../../types/admin'

/** One coin card's change history, from the card's History button. */
export default function AssetHistoryModal({ asset, onClose }: { asset: AdminAsset; onClose: () => void }) {
  return (
    <HelperModal
      title={`${displaySymbol(asset.ticker)}${asset.broker ? ` on ${asset.broker}` : ''} — changes`}
      subtitle="Every change to this coin's settings, newest first: who made it and what it was before."
      icon={<History size={17} />}
      onClose={onClose}
      footer={
        <button type="button" className={HELPER_BTN_SECONDARY} onClick={onClose}>
          Close
        </button>
      }
    >
      <AssetHistoryList assetId={asset.asset_id} hideCoin />
    </HelperModal>
  )
}

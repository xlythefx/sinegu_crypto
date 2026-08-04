/** Which direction the bot may take on an asset. */
export type AssetSide = 'ALL' | 'LONG' | 'SHORT'

/**
 * One enabled asset from `GET /assets` — the trader-facing catalog.
 *
 * The sizing columns (`base_size`, `max_increments`) are deliberately absent:
 * the API never sends them to traders, only to admins and the engine.
 */
export interface TradableAsset {
  asset_id: number
  ticker: string
  type: string | null
  broker: string | null
  side: AssetSide
  asset_image: string | null
}

import { useState } from 'react'
import { useApiData } from './useApiData'
import { usePoll } from './usePoll'
import { getOrderBook, ORDER_BOOK_REFRESH_MS } from '../services/market'
import { bookIsLive, buildBookModel } from '../lib/orderBook'

/**
 * The hero's live order book: the raw payload, the ladder/histogram model
 * built from it, and whether the exchange's own stamp is recent enough to
 * call it live. Re-read every few seconds while the tab is visible. Shared by
 * the classic card (`landing/OrderBook`) and the pixel one
 * (`landing-next/PixelOrderBook`), so the two can never poll differently.
 */
export function useOrderBook() {
  const { data, reload } = useApiData(getOrderBook)
  const [now, setNow] = useState(() => Date.now())

  usePoll(() => {
    setNow(Date.now())
    reload()
  }, ORDER_BOOK_REFRESH_MS)

  return {
    data,
    book: data ? buildBookModel(data.bids, data.asks) : null,
    live: bookIsLive(data?.book_at ?? null, now),
  }
}

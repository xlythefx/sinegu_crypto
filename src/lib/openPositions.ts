import type { AdminOpenPosition } from '../types/openPositions'

/** Selection key for an open-positions row — ids repeat across venues' tables. */
export const positionKey = (p: Pick<AdminOpenPosition, 'exchange' | 'id'>) => `${p.exchange}:${p.id}`

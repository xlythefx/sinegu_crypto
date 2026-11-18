import type { SignalFeed } from '../types/feeds'

/**
 * Read a feed off the wire. Anything unknown — including an API older than
 * the test / sub-master feeds, which sends none — is the main feed.
 */
export function feedOf(value: unknown): SignalFeed {
  return value === 'test' || value === 'submaster' ? value : 'main'
}

/** Feeds that are private to one role (never public, never the master's). */
export function isPrivateFeed(feed: SignalFeed | undefined): boolean {
  return feed === 'test' || feed === 'submaster'
}

/** The feed's name in a sentence ("belongs to the main feed"). */
export const FEED_NAME: Record<SignalFeed, string> = {
  main: 'main',
  test: 'test',
  submaster: 'sub-master',
}

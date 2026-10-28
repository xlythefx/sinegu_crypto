import { apiFetch } from './api'

export interface VisitPing {
  path: string
  /** The first page of this page load — the one the referrer belongs to. */
  entry: boolean
  referrer?: string
  ref?: string
  utm_source?: string
  utm_campaign?: string
  /** `navigator.webdriver`: an automated browser. The API throws it away. */
  webdriver: boolean
}

/**
 * The visitor counter's ping. The session token rides along when there is
 * one — that is how the API leaves staff out — and every failure is
 * swallowed: a missing count must never be an error on a visitor's screen.
 */
export function recordVisit(ping: VisitPing): void {
  apiFetch<unknown>('/public/visits', { method: 'POST', body: ping, auth: true }).catch(() => {})
}

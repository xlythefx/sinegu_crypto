/** Admin → Error Bot (`GET /admin/devbot`). Never carries a secret — only whether one is set. */

export interface DevBotCheck {
  key: string
  name: string
  /** true = working, false = a problem, null = unknown / not measured. */
  ok: boolean | null
  detail: string
}

export interface DevBotKind {
  key: string
  label: string
  description: string
}

export interface DevBotSettings {
  disabled_kinds: string[]
  /** ISO time the mute ends, or null when not muted. */
  muted_until: string | null
  agent_paused: boolean
  /** Start the PC agent by itself on a new kind of error. */
  auto_investigate: boolean
  updated_by: string | null
  updated_at: string | null
}

export type DevBotJobStatus = 'queued' | 'working' | 'done' | 'failed' | 'cancelled'

export interface DevBotJob {
  id: number
  status: DevBotJobStatus
  /** message (typed to the bot) | button (Investigate) | auto (started by itself) | deploy */
  source: string
  kind: string | null
  prompt: string
  summary: string | null
  links: { label: string; url: string }[]
  created_at: string | null
  claimed_at: string | null
  finished_at: string | null
}

export interface DevBotActionRow {
  id: number
  kind: 'add_asset' | 'deploy' | string
  status: string
  subject: string
  result: string | null
  resolved_by: string | null
  occurrences: number
  created_at: string | null
  resolved_at: string | null
}

export interface AdminDevBotData {
  bot: {
    configured: boolean
    token_set: boolean
    chat_set: boolean
    webhook_secret_set: boolean
    agent_key_set: boolean
    webhook_url: string | null
    webhook_pending: number | null
    webhook_error: string | null
  }
  settings: DevBotSettings
  kinds: DevBotKind[]
  agent: { online: boolean; last_seen_at: string | null; paused: boolean }
  checks: DevBotCheck[]
  memories: DevBotMemory[]
  jobs: DevBotJob[]
  actions: DevBotActionRow[]
}

/** One thing the PC agent learned (or an admin wrote down); read before every job. */
export interface DevBotMemory {
  id: number
  title: string
  body: string
  /** The kind of error it explains, e.g. `signal:binance:main:LTCUSDT:order_failed`. */
  signature: string | null
  source: 'agent' | 'admin' | string
  job_id: number | null
  updated_by: string | null
  created_at: string | null
  updated_at: string | null
}

/** A settings write; an absent key is left unchanged. `mute_minutes: 0` unmutes. */
export interface DevBotSettingsPatch {
  disabled_kinds?: string[]
  mute_minutes?: 0 | 60 | 480 | 1440
  agent_paused?: boolean
  auto_investigate?: boolean
}

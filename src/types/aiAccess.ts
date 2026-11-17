/** Admin → AI Access (GET /admin/ai-access and friends). */

export type AiKeyState = 'active' | 'expired' | 'revoked'

export interface AiAccessKey {
  id: number
  name: string
  /** First characters of the key — enough to tell keys apart, never enough to use one. */
  prefix: string
  state: AiKeyState
  created_by_name: string | null
  created_at: string | null
  expires_at: string | null
  last_used_at: string | null
  last_used_ip: string | null
  revoked_at: string | null
  revoked_by_name: string | null
  /** May make images / clips and Idea plans in Creatives (off until a full admin switches it on). */
  can_create: boolean
  can_create_changed_by_name: string | null
  can_create_changed_at: string | null
}

/** What a key switched on for Creatives may also do, its limits, and what each key spent. */
export interface AiCreateAccess {
  tools: AiToolInfo[]
  max_per_generation_usd: number
  max_per_key_day_usd: number
  /** What everything it makes is labelled ("Grok"). */
  label: string
  spent: Array<{ key_id: number; today_usd: number; month_usd: number; generations: number }>
}

export interface AiConnectorSettings {
  /** What goes in the connector's "Server URL" field. */
  server_url: string
  /** The connector's "Type" option. */
  type: string
  /** The HTTP header the key travels in. */
  header_name: string
}

export interface AiToolInfo {
  name: string
  title: string
  description: string
}

export interface AiAccessData {
  keys: AiAccessKey[]
  connector: AiConnectorSettings
  expiry_days: number[]
  default_expiry_days: number
  max_active_keys: number
  tools: AiToolInfo[]
  create: AiCreateAccess
}

export interface AiCreatedKey {
  key: AiAccessKey
  /** Shown once, right after creation. The server cannot show it again. */
  plain_key: string
}

export interface AiLogEntry {
  id: number
  key_id: number | null
  key_name: string | null
  method: string
  tool: string | null
  arguments: Record<string, unknown> | null
  status: 'ok' | 'error'
  error: string | null
  response_bytes: number | null
  duration_ms: number | null
  ip: string | null
  created_at: string
}

export interface AiLogPage {
  entries: AiLogEntry[]
  has_more: boolean
  last_24h: { calls: number; questions: number; errors: number }
}

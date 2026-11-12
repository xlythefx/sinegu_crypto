/**
 * Admin → Creatives (GET /admin/creatives and friends) — the marketing team's
 * page for planning X / TikTok posts and generating images and videos of the
 * one pixel-art character with Higgsfield. Shapes follow the API contract
 * exactly; nothing here is derived.
 */

export type CreativeModelKey =
  | 'soul-image'
  | 'grok-image'
  | 'kling-animate'
  | 'seedance-reference'
  | 'seedance-text-video'

export type CreativeKind = 'image' | 'video'

export type CreativeParamValue = string | number | boolean | null

export interface CreativeModelParam {
  /** 'aspect_ratio' | 'resolution' | 'batch_size' | 'quality' | 'duration' | 'negative_prompt' | 'generate_audio' */
  name: string
  label: string
  type: 'select' | 'integer' | 'boolean' | 'text'
  /** For `select`. */
  options?: Array<string | number>
  /** For `integer`. */
  min?: number
  max?: number
  default: CreativeParamValue
}

export interface CreativeModelPreset {
  /** A string so a preset the server adds later still renders. */
  key: CreativeModelKey | (string & {})
  label: string
  kind: CreativeKind
  /** One plain sentence for the picker. */
  description: string
  /** Sends the character's reference images (grok-image, seedance-reference). */
  uses_references: boolean
  /** Cannot run without the character's references: "Use the character" is always on. */
  requires_character?: boolean
  /** Needs one source image to animate (kling-animate). */
  needs_source: boolean
  /** e.g. "about $0.30 for 5 s". */
  price_hint: string
  params: CreativeModelParam[]
}

export interface CreativeBudgetPerson {
  uni_id: string | null
  name: string | null
  /** Generations AND AI writing together. */
  spent_usd: number
  generations: number
  /** AI drafts and idea lists this person asked for (absent from an API older than the AI writer). */
  ai_calls?: number
}

export interface CreativeBudget {
  /** 'YYYY-MM' (UTC calendar month). */
  month: string
  cap_usd: number
  /** Includes the reserved part. */
  spent_usd: number
  /** The part of spent still generating (submitting / queued / in_progress). */
  reserved_usd: number
  /** max(0, cap − spent). */
  remaining_usd: number
  /** How many generations this month. */
  generations: number
  /** The AI-writing part of `spent_usd` (absent from an API older than the AI writer). */
  ai_usd?: number
  /** AI drafts, idea lists and weekly recaps written this month. */
  ai_calls?: number
  by_person: CreativeBudgetPerson[]
  updated_by_name: string | null
  /** ISO. */
  updated_at: string | null
}

/** The AI writer (Claude) on this server. */
export interface CreativeAiMeta {
  /** False = no Anthropic key on this server: the AI buttons are off, writing by hand still works. */
  configured: boolean
  model: string
  /** Claude drafts a "Weekly recap" plan every Saturday (full admins switch it). */
  weekly_recap: boolean
}

export interface CreativesMeta {
  /** False = no Higgsfield key on this server: planning works, generating does not. */
  configured: boolean
  /** The AI writer. The service fills "not connected" when an older API sends none. */
  ai: CreativeAiMeta
  /** How long Higgsfield keeps a result before deleting it (7). */
  retention_days: number
  /** Reference images the character may hold (8). */
  max_references: number
  models: CreativeModelPreset[]
  budget: CreativeBudget
  /** Full admins only — collaborators see the cap read-only. */
  can_edit_budget: boolean
}

export type CreativePlanStatus = 'idea' | 'script' | 'generating' | 'review' | 'approved' | 'posted'
export type CreativePlatform = 'x' | 'tiktok'
export type CreativeFormat = 'video' | 'image' | 'carousel'

export interface CreativePlan {
  id: number
  title: string
  status: CreativePlanStatus
  platform: CreativePlatform
  format: CreativeFormat
  /** 'YYYY-MM-DD'. */
  planned_for: string | null
  hook: string | null
  script: string | null
  caption: string | null
  hashtags: string | null
  notes: string | null
  posted_url: string | null
  /** The Studio prompt for this post (the AI writes one; editable). */
  video_prompt: string | null
  /** ISO — set when fields from an AI draft were saved; null = written by hand. */
  ai_drafted_at: string | null
  generations_count: number
  created_by_name: string | null
  updated_by_name: string | null
  /** ISO. */
  created_at: string
  updated_at: string
}

/** POST body; PUT takes any subset (an absent key = unchanged). */
export interface CreativePlanInput {
  title: string
  status: CreativePlanStatus
  platform: CreativePlatform
  format: CreativeFormat
  planned_for: string | null
  hook: string | null
  script: string | null
  caption: string | null
  hashtags: string | null
  notes: string | null
  posted_url: string | null
  /** ≤ 4000. */
  video_prompt: string | null
  /** True = these fields came from an AI draft (the server stamps `ai_drafted_at` once). */
  ai_drafted?: boolean
}

/* ---------- the AI writer ---------- */

/** One AI draft of a whole plan. Never saved by the API — the modal fills its fields with it. */
export interface CreativeAiDraft {
  /** ≤ 160. */
  title: string
  /** The first line / first 2 seconds. */
  hook: string
  /** Scene by scene ("1. (0–3 s) …"), or slide by slide for an image / carousel. */
  script: string
  /** Within the platform's limit; the disclaimer is appended when a % is cited. */
  caption: string
  /** Space-separated, each starting with #. */
  hashtags: string
  /** A Studio prompt for the scene (the Studio adds the character's look itself). */
  video_prompt: string
  /** Why this angle, what to check before posting. */
  notes: string
  /** Every figure the draft cites, verbatim from the week's facts ([] when none). */
  numbers_used: string[]
  /** Checked on the server after the model answered: unknown figures, a caption over the limit. */
  warnings: string[]
}

/** The PUBLIC figures a draft was allowed to quote (the published track record's week). */
export interface CreativeAiFacts {
  /** False = nothing was published for the window, so the draft quotes no figures. */
  available: boolean
  /** "3–9 Nov 2026". */
  period: string
  return_pct: number | null
  trades: number
  trading_days: number
  green_days: number
  best_day: { date: string; pct: number } | null
  top_coins: { symbol: string; share_pct: number }[]
}

export interface CreativeAiDraftInput {
  /** 3–500. */
  brief: string
  platform: CreativePlatform
  format?: CreativeFormat
  /** Links the call's cost record to the plan being edited. */
  plan_id?: number
  /** Default true: let the draft quote this week's public results. */
  use_facts?: boolean
}

export interface CreativeAiDraftResult {
  draft: CreativeAiDraft
  /** null when the facts were not used. */
  facts_used: CreativeAiFacts | null
  cost_usd: number
  budget: CreativeBudget
}

export interface CreativeAiIdea {
  title: string
  hook: string
  why: string
  platform: CreativePlatform
  format: CreativeFormat
}

export interface CreativeAiIdeasInput {
  /** 3–8, default 5. */
  count?: number
  /** ≤ 300. */
  focus?: string
  /** null = either platform. */
  platform?: CreativePlatform | null
}

export interface CreativeAiIdeasResult {
  ideas: CreativeAiIdea[]
  cost_usd: number
  budget: CreativeBudget
}

export interface CreativeCharacterRef {
  id: number
  label: string | null
  source: 'upload' | 'generation'
  mime: string
  bytes: number
  /** Signed RELATIVE path ("/api/creatives/refs/3/image?expires=…&signature=…"), valid 2 h. */
  image_path: string
  created_at: string
}

export interface CreativeCharacter {
  id: number
  name: string
  look: string | null
  style_prompt: string | null
  rules: string | null
  refs: CreativeCharacterRef[]
  updated_by_name: string | null
  updated_at: string | null
}

export interface CreativeCharacterInput {
  name: string
  look: string | null
  style_prompt: string | null
  rules: string | null
}

export type CreativeGenerationStatus =
  | 'submitting'
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'nsfw'
  | 'canceled'
  | 'expired'

export interface CreativeOutput {
  type: CreativeKind
  /** Higgsfield's own public URL — good for a preview until `expires_at`. */
  url: string
  /** Signed RELATIVE path to our streaming download, valid 30 min. */
  download_path: string
}

export interface CreativeGeneration {
  id: number
  plan_id: number | null
  plan_title: string | null
  kind: CreativeKind
  model: string
  model_label: string
  prompt: string
  params: Record<string, unknown>
  used_character: boolean
  status: CreativeGenerationStatus
  error: string | null
  /** [] unless completed and not expired. */
  outputs: CreativeOutput[]
  estimated_usd: number
  charged_usd: number
  expires_at: string | null
  completed_at: string | null
  created_at: string
  created_by_name: string | null
}

export interface CreativeGenerationPage {
  generations: CreativeGeneration[]
  has_more: boolean
}

/** What kling-animate moves: one completed image output, or one character reference. */
export type CreativeSource = { generation_id: number; index: number } | { ref_id: number }

export interface CreativeGenerationInput {
  model: string
  prompt: string
  params: Record<string, CreativeParamValue>
  use_character: boolean
  plan_id?: number
  source?: CreativeSource
}

export interface CreativeEstimate {
  usd: number
  budget: CreativeBudget
  /** False = this would pass the month's cap; the server would refuse it. */
  allowed: boolean
}

/* ---------- the chat agent (Admin → Creatives workspace) ---------- */

/** Ask = talk it through (reads, saves memory, never spends). Generate = it may propose paid jobs. */
export type CreativeAgentMode = 'ask' | 'generate'

export type CreativeAgentMessageKind =
  | 'user'
  | 'assistant'
  | 'activity'
  | 'job'
  | 'plan'
  | 'notice'
  | 'choices'
  | 'video'

/** One button of an `ask_choices` question; a click sends `value` as the next message. */
export interface CreativeAgentChoiceOption {
  label: string
  value: string
}

/** The agent asked a question with buttons ("X or TikTok?"). The turn ended with it. */
export interface CreativeAgentChoices {
  question: string
  options: CreativeAgentChoiceOption[]
  /** Offer an "Other…" box beside the buttons. */
  allow_other: boolean
}

/** One tool the agent ran, as one plain line ("Read the planner", "Saved to memory: …"). */
export interface CreativeAgentActivity {
  tool: string
  label: string
  ok: boolean
}

/**
 * What the chat shows — never the raw model blocks (thinking, tool calls).
 * Ordered by id; a session answer carries every one, a turn only the new ones.
 */
export interface CreativeAgentMessage {
  id: number
  kind: CreativeAgentMessageKind
  /** user / assistant (Markdown) / notice; for 'plan', the plan's title. */
  text?: string
  activity?: CreativeAgentActivity
  /** kind 'job' — the card is drawn from the session's `jobs`. */
  job_id?: number
  /** kind 'plan' — "Created plan: …", opens the Plans panel at that plan. */
  plan_id?: number
  /** kind 'choices' — the question and its buttons. */
  choices?: CreativeAgentChoices
  /** kind 'video' — the video project it made (text = its title). */
  video_id?: number
  mode?: CreativeAgentMode
  /** ISO. */
  created_at: string
}

export type CreativeAgentJobStatus =
  | 'proposed'
  | 'running'
  | 'completed'
  /** Every step finished, but some scenes failed (the others landed). */
  | 'completed_with_failures'
  | 'failed'
  | 'canceled'
  | 'expired'

export type CreativeAgentStepStatus = 'waiting' | 'running' | 'completed' | 'failed' | 'canceled'

/** One paid step of a job: one Higgsfield generation, priced before Go. */
export interface CreativeAgentJobStep {
  label: string
  model: string
  model_label: string
  usd: number
  status: CreativeAgentStepStatus
  /** null until the step has started. */
  generation: CreativeGeneration | null
  error: string | null
}

/**
 * A job the agent proposed in Generate mode: one or more priced steps,
 * started with ONE "Go" (approve). It never spends by itself.
 */
export interface CreativeAgentJob {
  id: number
  title: string
  status: CreativeAgentJobStatus
  plan_id: number | null
  plan_title: string | null
  /** The whole job, every step together. */
  estimated_usd: number
  steps: CreativeAgentJobStep[]
  approved_by_name: string | null
  /** ISO. */
  created_at: string
  /** ISO — a proposed job must get its Go before this (60 min), else it expires. */
  expires_at: string | null
  /** The video project this job fills (Creatives v2); absent on a single-clip job. */
  video_id?: number | null
  /** The website path of that project's editor ("/admin/creatives/editor/12"). */
  editor_path?: string | null
}

export interface CreativeAgentSession {
  /** uuid. */
  id: string
  /** The mode the last turn ran in. */
  mode: CreativeAgentMode
}

/** GET /agent/session and POST /agent/sessions. */
export interface CreativeAgentSessionState {
  session: CreativeAgentSession
  messages: CreativeAgentMessage[]
  jobs: CreativeAgentJob[]
  budget: CreativeBudget
  /**
   * Said once: 'new_tools' = the agent learned new tools, so the old chat was
   * closed and this is a fresh one.
   */
  notice?: 'new_tools' | null
}

export type CreativeAgentTurnStatus = 'continue' | 'done' | 'awaiting_approval' | 'error'

export interface CreativeAgentTurnInput {
  session_id: string
  mode: CreativeAgentMode
  /** 1–4000. Left out for the next step of the same answer (`continue`). */
  text?: string
}

/** One model call. `continue` = call again (no text) for the next step. */
export interface CreativeAgentTurnResult {
  status: CreativeAgentTurnStatus
  /** Only the NEW messages. */
  messages: CreativeAgentMessage[]
  /** New or changed jobs. */
  jobs: CreativeAgentJob[]
  budget: CreativeBudget
  /** What this one call cost (Claude), already counted in `budget`. */
  cost_usd: number
}

export interface CreativeAgentJobResult {
  job: CreativeAgentJob
  budget: CreativeBudget
}

/** The brand brief: one Markdown document the agent always follows. */
export interface CreativeBrief {
  markdown: string
  updated_by_name: string | null
  /** ISO. */
  updated_at: string | null
}

export type CreativeMemoryCategory = 'brand' | 'audience' | 'performance' | 'process' | 'other'

/** A team-wide note the agent remembers across chats. */
export interface CreativeMemory {
  id: number
  /** ≤ 500. */
  text: string
  /** A string so a category the server adds later still renders (as "Other"). */
  category: CreativeMemoryCategory | (string & {})
  /** Saved by the agent in a chat, or typed by a person in the Memory panel. */
  source: 'agent' | 'person'
  created_by_name: string | null
  /** Not in the contract; shown when an API sends it. */
  updated_by_name?: string | null
  /** ISO. */
  updated_at: string
}

export interface CreativeMemoryInput {
  text: string
  category?: CreativeMemoryCategory
}

/** The video playbook: the base every video follows. Same shape as the brief. */
export type CreativePlaybook = CreativeBrief

/* ---------- marketing styles ---------- */

export type CreativeStylePlatform = 'x' | 'tiktok' | 'any'

/** One look a video can come out in ("Pixel arcade", "Data recap"). Team-edited. */
export interface CreativeStyle {
  id: number
  /** `^[a-z0-9-]{3,40}$` — what the agent names it by. */
  slug: string
  name: string
  /** One line the agent reads when choosing (≤ 200). */
  summary: string
  /** The style's rules, Markdown (≤ 20,000). */
  markdown: string
  default_platform: CreativeStylePlatform
  default_aspect: '9:16' | '16:9' | '1:1'
  /** How much mascot it wants. */
  pixel_default: 'none' | 'cameo' | 'lead'
  default_engine: 'kling' | 'seedance'
  caption_style: 'clean' | 'bold' | 'pixel'
  template_family: 'clean' | 'pixel'
  /** 'none' or a chiptune preset. */
  music_default: 'none' | 'arcade-upbeat' | 'arcade-chill' | 'arcade-boss' | 'arcade-victory'
  /** Pixelate + scanlines on by default. */
  pixel_look: boolean
  enabled: boolean
  sort: number
  updated_by_name: string | null
  /** ISO. */
  updated_at: string | null
}

/** POST body (all but id and the stamps); PUT takes any subset. */
export type CreativeStyleInput = Omit<CreativeStyle, 'id' | 'updated_by_name' | 'updated_at'>

/* ---------- the Context view ---------- */

export interface CreativeAgentToolView {
  name: string
  description: string
  input_schema: unknown
}

/** Exactly what the agent reads, read-only (GET /admin/creatives/agent/context). */
export interface CreativeAgentContextView {
  system: string
  tools: CreativeAgentToolView[]
  playbook: { version: string | number | null; markdown: string }
  brief: { version: string | number | null; markdown: string }
  memory: { version: string | number | null; text: string }
  styles: Array<{ slug: string; name: string; summary: string }>
  /** The [Context] block the next message would carry. */
  context_block: string
}

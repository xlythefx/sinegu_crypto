/**
 * An item on Admin → To be Done: something only the owner can do or decide.
 * Authored in code (`lib/adminTodos.ts`) by whoever builds the feature that
 * leaves the work; the done-state and the note live on the API.
 */
export interface AdminTodo {
  /** Stable slug — the API's key. Never renamed once shipped. */
  id: string
  /** The feature it belongs to; the page groups and filters by it. */
  feature: string
  /** `action` = go and do something; `decision` = a choice only the owner can make. */
  kind: 'action' | 'decision'
  title: string
  /** YYYY-MM-DD the item was added. */
  added: string
  /** Why it matters — what stays broken or undecided until it is done. */
  why: string
  /** The steps, in order. Plain sentences; a step may name an env key or a URL. */
  steps: string[]
  /** `.env` keys the steps fill in (rendered as chips). */
  envKeys?: string[]
  links?: { label: string; href: string }[]
}

/** GET /admin/todos — one entry per slug the owner has touched. */
export interface AdminTodoState {
  done_at: string | null
  done_by: string | null
  done_by_name: string | null
  note: string | null
}

export type AdminTodoStates = Record<string, AdminTodoState>

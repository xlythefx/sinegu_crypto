import { apiFetch } from './api'
import type { AdminTodoState, AdminTodoStates } from '../types/adminTodos'

/** GET /admin/todos — the owner's done-state per item slug. */
export async function getAdminTodoStates(): Promise<AdminTodoStates> {
  const res = await apiFetch<{ success: boolean; states: AdminTodoStates | AdminTodoState[] }>(
    '/admin/todos',
    { auth: true },
  )
  // An empty map arrives as `{}`; guard against an array from an older shape.
  return Array.isArray(res.states) ? {} : (res.states ?? {})
}

/** PUT /admin/todos/{slug} — tick / untick and/or set the note. */
export async function updateAdminTodo(
  slug: string,
  patch: { done?: boolean; note?: string | null },
): Promise<AdminTodoState> {
  const res = await apiFetch<{ success: boolean; slug: string; state: AdminTodoState }>(
    `/admin/todos/${encodeURIComponent(slug)}`,
    { method: 'PUT', auth: true, body: patch },
  )
  return res.state
}

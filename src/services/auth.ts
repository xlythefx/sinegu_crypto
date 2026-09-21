import { apiFetch } from './api'
import { clearSession, saveSession } from '../lib/session'
import { TERMS } from '../lib/terms'
import type { AuthResponse } from '../types/auth'

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  })
  saveSession(res.token, res.user)
  return res
}

export async function register(
  name: string,
  email: string,
  password: string,
  passwordConfirmation: string,
  referralCode?: string,
): Promise<AuthResponse> {
  const res = await apiFetch<AuthResponse>('/auth/register', {
    method: 'POST',
    body: {
      name,
      email,
      password,
      password_confirmation: passwordConfirmation,
      // The form cannot submit without the checkbox (it is `required`), so
      // reaching here IS the acceptance. The version is the Terms' "Last
      // updated" date, stored on the row so a later revision can be told
      // apart from what this user agreed to.
      terms: true,
      terms_version: TERMS.updatedAt,
      // Invalid codes are silently ignored server-side; registration proceeds.
      ...(referralCode ? { referral_code: referralCode } : {}),
    },
  })
  saveSession(res.token, res.user)
  return res
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/auth/logout', { method: 'POST', auth: true })
  } finally {
    // Always clear locally, even if the API call fails.
    clearSession()
  }
}

/**
 * Asks for a reset code by email. Always resolves for a well-formed address —
 * the API answers the same whether or not the email is registered, so the
 * screen can only ever say "check your inbox".
 */
export async function forgotPassword(email: string): Promise<void> {
  await apiFetch('/auth/forgot-password', { method: 'POST', body: { email } })
}

/** Redeems the six-digit code. Rejects with ApiError (`INVALID_CODE`) on a bad or expired one. */
export async function resetPassword(
  email: string,
  code: string,
  password: string,
  passwordConfirmation: string,
): Promise<void> {
  await apiFetch('/auth/reset-password', {
    method: 'POST',
    body: { email, code, password, password_confirmation: passwordConfirmation },
  })
}

import { apiFetch } from './api'
import { clearSession, saveSession } from '../lib/session'
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

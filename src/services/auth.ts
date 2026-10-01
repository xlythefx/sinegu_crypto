import { apiFetch } from './api'
import { clearSession, saveSession, saveUser } from '../lib/session'
import { TERMS } from '../lib/terms'
import type { AuthResponse, AuthUser } from '../types/auth'

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

/**
 * Redeems the six-digit sign-up code for the signed-in user and stores the
 * returned (now verified) user in the session. Rejects with ApiError
 * `INVALID_CODE` (422) whose payload carries `attempts_left` / `expired` —
 * read it with {@link readVerifyFailure}.
 */
export async function verifyEmail(code: string): Promise<AuthUser> {
  const res = await apiFetch<{ user: AuthUser }>('/auth/email/verify', {
    method: 'POST',
    body: { code },
    auth: true,
  })
  saveUser(res.user)
  return res.user
}

export interface ResendVerificationResponse {
  message?: string
  /** Seconds until another code may be requested. */
  retry_after?: number
}

/**
 * Mails a fresh code (and resets the attempt counter). Rejects with ApiError
 * `RESEND_TOO_SOON` (409) whose payload carries `retry_after`.
 */
export function resendVerification(): Promise<ResendVerificationResponse> {
  return apiFetch<ResendVerificationResponse>('/auth/email/resend', {
    method: 'POST',
    auth: true,
  })
}

/** The detail a refused verification carries, when the API sent it. */
export interface VerifyFailure {
  attemptsLeft?: number
  expired: boolean
  retryAfter?: number
}

export function readVerifyFailure(payload: unknown): VerifyFailure {
  const p = (payload ?? {}) as Record<string, unknown>
  return {
    attemptsLeft: typeof p.attempts_left === 'number' ? p.attempts_left : undefined,
    expired: p.expired === true,
    retryAfter: typeof p.retry_after === 'number' ? p.retry_after : undefined,
  }
}

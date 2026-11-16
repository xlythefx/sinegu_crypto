import { apiFetch, API_URL, ApiError } from './api'
import { getToken } from '../lib/session'
import type { AuthUser } from '../types/auth'
import type { ContactHandles, ContactStatus } from '../types/signupInfo'

export interface MeResponse {
  success: boolean
  user: AuthUser
}

export interface UpdateProfileResponse {
  success: boolean
  message: string
  user: AuthUser
}

export interface UpdatePasswordResponse {
  success: boolean
  message: string
}

/** Current authenticated user (GET /auth/me). */
export function getMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>('/auth/me', { auth: true })
}

/**
 * Update the user's name/email (PUT /user/profile).
 *
 * A changed email needs `currentPassword` and does NOT take effect on save:
 * the API mails a code to the new address and returns it as
 * `user.pending_email`, with `user.email` unchanged until the code is
 * redeemed (`verifyEmail`). 422 `error_code`s: `PASSWORD_REQUIRED`,
 * `INVALID_PASSWORD`, `NO_PASSWORD` (a Discord-only account must set one first).
 */
export function updateProfile(
  name: string,
  email: string,
  currentPassword?: string,
): Promise<UpdateProfileResponse> {
  return apiFetch<UpdateProfileResponse>('/user/profile', {
    method: 'PUT',
    auth: true,
    body: {
      name,
      email,
      ...(currentPassword ? { current_password: currentPassword } : {}),
    },
  })
}

export interface CancelPendingEmailResponse {
  success: boolean
  user: AuthUser
}

/**
 * Abandon an email change that is waiting for its code
 * (DELETE /user/email/pending). The stored address was never touched, so
 * this needs no confirmation step.
 */
export function cancelPendingEmail(): Promise<CancelPendingEmailResponse> {
  return apiFetch<CancelPendingEmailResponse>('/user/email/pending', {
    method: 'DELETE',
    auth: true,
  })
}

export type ProfileImageType = 'profile' | 'banner'

/**
 * Upload a profile or banner image (POST /user/image, multipart). Returns the
 * updated user with absolute image URLs. Uses fetch directly since apiFetch
 * only sends JSON.
 */
export async function uploadProfileImage(
  type: ProfileImageType,
  file: File,
): Promise<UpdateProfileResponse> {
  const form = new FormData()
  form.append('type', type)
  form.append('image', file)

  const token = getToken()
  let res: Response
  try {
    res = await fetch(`${API_URL}/user/image`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form,
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is the API running?')
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data.message ?? `Upload failed (${res.status})`,
      data.error_code,
      data.errors,
    )
  }
  return data as UpdateProfileResponse
}

/**
 * Give a Discord-only account its first password (POST /user/password/set).
 * Allowed only while the account has none — errorCode 'HAS_PASSWORD' otherwise.
 */
export function setPassword(
  password: string,
  passwordConfirmation: string,
): Promise<UpdateProfileResponse> {
  return apiFetch<UpdateProfileResponse>('/user/password/set', {
    method: 'POST',
    auth: true,
    body: { password, password_confirmation: passwordConfirmation },
  })
}

/**
 * Change the user's password (PUT /user/password). A wrong current password
 * surfaces as an ApiError with status 422 and errorCode 'INVALID_PASSWORD'.
 */
export function updatePassword(
  currentPassword: string,
  newPassword: string,
  newPasswordConfirmation: string,
): Promise<UpdatePasswordResponse> {
  return apiFetch<UpdatePasswordResponse>('/user/password', {
    method: 'PUT',
    auth: true,
    body: {
      current_password: currentPassword,
      new_password: newPassword,
      new_password_confirmation: newPasswordConfirmation,
    },
  })
}

/**
 * Telegram / Discord / WhatsApp, plus which required ones are missing and
 * whether that locks connecting an exchange (GET /user/contacts). The
 * dashboard reminder and the connect page read the API's verdict, never a
 * client copy of the rule.
 */
export async function getContactStatus(): Promise<ContactStatus> {
  const { contacts, missing, connect_locked } = await apiFetch<{ success: boolean } & ContactStatus>(
    '/user/contacts',
    { auth: true },
  )
  return { contacts, missing: missing ?? [], connect_locked: !!connect_locked }
}

/**
 * Save them (PUT /user/contacts). A key left out is unchanged; null clears
 * Discord and is refused for Telegram / WhatsApp (required). 422 with a
 * field error under the field for a value no username / number can be.
 */
export async function updateContactHandles(changes: Partial<ContactHandles>): Promise<ContactStatus> {
  const { contacts, missing, connect_locked } = await apiFetch<{ success: boolean } & ContactStatus>(
    '/user/contacts',
    { method: 'PUT', auth: true, body: changes },
  )
  return { contacts, missing: missing ?? [], connect_locked: !!connect_locked }
}

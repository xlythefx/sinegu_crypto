import { apiFetch, API_URL, ApiError } from './api'
import { getToken } from '../lib/session'
import type { AuthUser } from '../types/auth'

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

/** Update the user's name/email (PUT /user/profile). */
export function updateProfile(
  name: string,
  email: string,
): Promise<UpdateProfileResponse> {
  return apiFetch<UpdateProfileResponse>('/user/profile', {
    method: 'PUT',
    auth: true,
    body: { name, email },
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

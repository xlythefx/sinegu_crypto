import { handleError, type SignupSource } from './signupSources'

/**
 * The sign-up wizard (owner, 2026-10-14): one question per screen, in the
 * owner's order — name → login → Telegram / Discord → where you heard about
 * us (+ Terms). The Discord sign-up runs the same screens minus the login,
 * which Discord already answered. Everything here is pure: the steps' words,
 * what each step checks before "Continue", and which step a server error
 * belongs to.
 */

export type RegisterStepKey = 'name' | 'login' | 'socials' | 'source'

export interface WizardStep {
  key: RegisterStepKey
  /** Short name under the progress bar. */
  label: string
  title: string
  subtitle: string
  /** The brand panel beside the form changes with the step (register page only). */
  panel: { kicker: string; title: string; body: string }
}

export const REGISTER_STEPS: readonly WizardStep[] = [
  {
    key: 'name',
    label: 'Name',
    title: 'What’s your name?',
    subtitle: 'Your full name, as it should appear on your account and invoices.',
    panel: {
      kicker: 'JOIN PIXEL ALPHA',
      title: 'Keep 80% of the upside.',
      body: 'Battle-tested bots trade on your own Binance, Bybit or MEXC account. Free to start — you only pay 20% of the profit you make.',
    },
  },
  {
    key: 'login',
    label: 'Login',
    title: 'Create your login',
    subtitle: 'You’ll sign in with this email. We’ll send a 6-digit code to confirm it.',
    panel: {
      kicker: 'YOUR FUNDS STAY PUT',
      title: 'Your money never leaves your exchange.',
      body: 'The bots trade through an API key you create on your exchange — one that can place trades but can never withdraw. You can disconnect it at any time.',
    },
  },
  {
    key: 'socials',
    label: 'Socials',
    title: 'Where can we reach you?',
    subtitle: 'Optional — add your Telegram or Discord so our team can message you about your account.',
    panel: {
      kicker: 'REAL PEOPLE',
      title: 'A team you can talk to.',
      body: 'A question about a trade, an invoice or your API key? Our support desk answers on Telegram and by email.',
    },
  },
  {
    key: 'source',
    label: 'About you',
    title: 'How did you hear about us?',
    subtitle: 'Optional — tick all that apply. It tells us what’s working.',
    panel: {
      kicker: 'ALMOST THERE',
      title: 'What happens next',
      body: 'Confirm your email with the code we send, and our team reviews your account — you’ll get an email as soon as it’s approved. Then connect your exchange and the bots get to work.',
    },
  },
]

/** The Discord sign-up: Discord already proved the email, so there is no login step. */
export const DISCORD_SIGNUP_STEPS: readonly WizardStep[] = [
  {
    ...REGISTER_STEPS[0],
    title: 'Check your name',
    subtitle: 'Discord confirmed who you are. This is the name on your account and invoices.',
  },
  {
    ...REGISTER_STEPS[2],
    label: 'Telegram',
    title: 'Your Telegram',
    subtitle: 'Optional — add it so our team can message you about your account.',
  },
  REGISTER_STEPS[3],
]

export const MIN_PASSWORD_LENGTH = 8
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface RegisterValues {
  name: string
  email: string
  password: string
  confirm: string
  telegram: string
  /** null on the Discord sign-up — its Discord is the linked one. */
  discord: string | null
  heardFrom: SignupSource[]
  heardOther: string
  terms: boolean
}

/** What stops "Continue" on this step, or null. The API checks everything again. */
export function stepProblem(key: RegisterStepKey, v: RegisterValues): string | null {
  switch (key) {
    case 'name':
      return v.name.trim() ? null : 'Please enter your name.'
    case 'login':
      if (!EMAIL_PATTERN.test(v.email.trim())) return 'Please enter a valid email address.'
      if (v.password.length < MIN_PASSWORD_LENGTH)
        return `Your password needs at least ${MIN_PASSWORD_LENGTH} characters.`
      if (v.password !== v.confirm) return 'The two passwords do not match.'
      return null
    case 'socials':
      return handleError(v.telegram, v.discord)
    case 'source':
      return v.terms ? null : 'Please accept the Terms to create your account.'
  }
}

/** The step a refused field lives on, so a server error sends the user back to it. */
export function stepForField(field: string): RegisterStepKey | null {
  if (field === 'name') return 'name'
  if (field === 'email' || field.startsWith('password')) return 'login'
  if (field === 'telegram' || field === 'discord') return 'socials'
  if (field.startsWith('heard_from') || field === 'terms') return 'source'
  return null
}

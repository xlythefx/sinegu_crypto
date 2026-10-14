import { Check } from 'lucide-react'
import PasswordField from '../PasswordField'
import { INPUT } from '../authClasses'
import { MIN_PASSWORD_LENGTH } from '../../../lib/registerWizard'

interface Props {
  email: string
  password: string
  confirm: string
  onEmail: (v: string) => void
  onPassword: (v: string) => void
  onConfirm: (v: string) => void
}

function Rule({ ok, children }: { ok: boolean; children: string }) {
  return (
    <li className={`flex items-center gap-2 transition-colors ${ok ? 'text-green' : 'text-faint'}`}>
      <span
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          ok ? 'border-transparent bg-green text-white' : 'border-border'
        }`}
      >
        {ok && <Check size={10} strokeWidth={3} />}
      </span>
      {children}
    </li>
  )
}

/** Step 2 — email, password, confirm, with the two password rules ticking as they are met. */
export default function LoginStep({ email, password, confirm, onEmail, onPassword, onConfirm }: Props) {
  return (
    <>
      <input
        type="email"
        placeholder="Email"
        className={INPUT}
        value={email}
        onChange={(e) => onEmail(e.target.value)}
        autoComplete="email"
        autoFocus
        required
      />
      <PasswordField
        placeholder="Password"
        value={password}
        onChange={(e) => onPassword(e.target.value)}
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        required
      />
      <PasswordField
        placeholder="Confirm password"
        value={confirm}
        onChange={(e) => onConfirm(e.target.value)}
        autoComplete="new-password"
        required
      />
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[12.5px]">
        <Rule ok={password.length >= MIN_PASSWORD_LENGTH}>{`At least ${MIN_PASSWORD_LENGTH} characters`}</Rule>
        <Rule ok={confirm.length > 0 && confirm === password}>Both passwords match</Rule>
      </ul>
    </>
  )
}

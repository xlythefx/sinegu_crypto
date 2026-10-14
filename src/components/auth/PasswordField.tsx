import { useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { INPUT } from './authClasses'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'>

/** A password input with a show / hide toggle inside it. */
export default function PasswordField(props: Props) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={`${INPUT} pr-12`} />
      <button
        type="button"
        className="absolute top-1/2 right-2 inline-flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[9px] border-0 bg-transparent text-faint transition-colors hover:text-text"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  )
}

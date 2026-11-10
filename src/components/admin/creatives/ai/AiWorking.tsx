import { LoaderCircle } from 'lucide-react'
import { NOTICE } from '../creativeClasses'

interface AiWorkingProps {
  busy: boolean
  elapsed: number
  /** "Claude is writing the whole post." */
  label: string
}

/**
 * The 10–40 s wait, said plainly: what is happening, a ticking counter and
 * how long it usually takes. The sentence is announced once; the counter is
 * hidden from screen readers so it does not read out every second.
 */
export default function AiWorking({ busy, elapsed, label }: AiWorkingProps) {
  if (!busy) return null
  return (
    <div className={NOTICE.info}>
      <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
      <p className="min-w-0 flex-1" role="status">
        {label} This usually takes 10–40 seconds.
      </p>
      <span className="flex-none font-mono text-[12px] tabular-nums" aria-hidden="true">
        {elapsed} s
      </span>
    </div>
  )
}

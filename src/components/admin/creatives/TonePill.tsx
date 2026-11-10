import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { CreativeTone } from '../../../lib/creatives'
import { PILL_BASE, TONE_PILL } from './creativeClasses'

interface TonePillProps {
  tone: CreativeTone
  icon?: LucideIcon
  title?: string
  children: ReactNode
}

/** A small status / platform / format pill in one of the page's tones. */
export default function TonePill({ tone, icon: Icon, title, children }: TonePillProps) {
  return (
    <span className={`${PILL_BASE} ${TONE_PILL[tone]}`} title={title}>
      {Icon && <Icon size={11} aria-hidden="true" className="flex-none" />}
      {children}
    </span>
  )
}

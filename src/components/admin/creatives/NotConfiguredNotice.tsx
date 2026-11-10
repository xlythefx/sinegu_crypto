import { PlugZap } from 'lucide-react'

/**
 * No Higgsfield key on this server: one clear line, shown above every tab.
 * Planning, the character and the budget all still work; only generating is off.
 */
export default function NotConfiguredNotice() {
  return (
    <div
      className="mb-stack flex items-start gap-3 rounded-row border border-accent-line bg-accent-soft px-4 py-3.5 animate-[fadeup_0.3s_ease_both]"
      role="status"
    >
      <PlugZap size={17} aria-hidden="true" className="mt-0.5 flex-none text-accent" />
      <div className="min-w-0 text-[12.5px] leading-[1.55]">
        <p className="font-bold text-text">Higgsfield isn’t connected on this server</p>
        <p className="mt-0.5 text-muted">
          Nothing can be generated here until it is. Planning, the character and the budget all still work.
        </p>
      </div>
    </div>
  )
}

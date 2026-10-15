import { CheckCircle2, CircleHelp, KeyRound, MessageSquareCode, XCircle } from 'lucide-react'
import CopyButton from './CopyButton'
import StatusChip from './StatusChip'
import { alertTemplate } from '../../../lib/webhooks'
import type { SignalFeed } from '../../../types/feeds'

interface AlertMessageCardProps {
  feed: SignalFeed
  /** The API holds this feed's secret (it signs the Manual Trade console with it). */
  secretSetOnApi: boolean
  /** Test feed: the engine has its test secret. null = unknown (engine silent). */
  engineHasSecret?: boolean | null
}

const CODE =
  'rounded-[5px] border border-hair bg-surface px-1 py-px font-mono text-[11.5px] text-text break-all'

/**
 * The message a TradingView alert sends, with a copy button. Same message for
 * every exchange of the feed — the ADDRESS decides the exchange. The secret is
 * a placeholder: the real one is never in the browser.
 */
export default function AlertMessageCard({
  feed,
  secretSetOnApi,
  engineHasSecret,
}: AlertMessageCardProps) {
  const template = alertTemplate(feed)
  const test = feed === 'test'

  return (
    <div className="flex min-w-0 flex-col gap-3.5 rounded-row border border-hair bg-surface2 p-4 max-[480px]:p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* The basis makes the button wrap under the text on a phone rather
            than squeezing the text into a sliver beside it. */}
        <div className="flex min-w-0 flex-1 basis-[260px] items-start gap-2.5">
          <MessageSquareCode size={16} className="mt-[2px] flex-none text-accent" aria-hidden="true" />
          <div className="min-w-0">
            <div className="text-[13.5px] font-bold text-text">Alert message</div>
            <div className="mt-0.5 text-[12px] leading-[1.5] text-muted">
              Paste it into the alert&apos;s Message box. One message fits every exchange of
              this feed — the address decides which exchange trades.
            </div>
          </div>
        </div>
        <CopyButton text={template} label="Copy alert message" variant="primary" />
      </div>

      {/* Scrolls sideways inside its own box on a narrow phone, never the page. */}
      <pre className="m-0 max-h-[260px] min-w-0 overflow-auto rounded-[10px] border border-hair bg-surface p-3 font-mono text-[12px] leading-[1.6] text-text">
        {template}
      </pre>

      <div className="flex flex-col gap-2.5">
        <p className="flex items-start gap-2 text-[12.5px] leading-[1.6] text-muted">
          <KeyRound size={14} className="mt-[3px] flex-none text-faint" aria-hidden="true" />
          <span className="min-w-0">
            <b className="font-semibold text-text">Where is the secret?</b>{' '}
            {test ? (
              <>
                On the engine as <code className={CODE}>BINANCE_ABCD_TEST_WEBHOOK_SECRET</code>{' '}
                — the same value as the API&apos;s{' '}
                <code className={CODE}>ENGINE_TEST_WEBHOOK_SECRET</code>.
              </>
            ) : (
              <>
                In the owner&apos;s TradingView credentials note (
                <code className={CODE}>.claude/tradingview.creds.md</code>, never committed), and
                on the engine as <code className={CODE}>BINANCE_ABCD_WEBHOOK_SECRET</code>.
              </>
            )}
          </span>
        </p>
        <div className="flex flex-wrap gap-1.5 pl-[22px]">
          <StatusChip
            tone={secretSetOnApi ? 'good' : 'bad'}
            icon={secretSetOnApi ? CheckCircle2 : XCircle}
            title="The API keeps its own copy to sign signals sent from the Manual Trade console."
          >
            {secretSetOnApi ? 'Set on the API' : 'Not set on the API'}
          </StatusChip>
          {test && (
            <StatusChip
              tone={engineHasSecret === true ? 'good' : engineHasSecret === false ? 'bad' : 'neutral'}
              icon={
                engineHasSecret === true
                  ? CheckCircle2
                  : engineHasSecret === false
                    ? XCircle
                    : CircleHelp
              }
              title="Without it the engine refuses every test signal (403)."
            >
              {engineHasSecret === true
                ? 'Set on the engine'
                : engineHasSecret === false
                  ? 'Not set on the engine'
                  : 'Engine: unknown'}
            </StatusChip>
          )}
        </div>
      </div>
    </div>
  )
}

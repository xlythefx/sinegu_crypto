import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Power, RefreshCw, ScrollText } from 'lucide-react'
import {
  CARD,
  CARD_SUB,
  CARD_TITLE,
  CHIP_BASE,
  CHIP_OFF,
  CHIP_ON,
  HEAD,
  HEAD_L,
  ICON_CHIP,
  NOTE_EMPTY,
  NOTE_ERROR,
} from './classes'
import { useApiData } from '../../../hooks/useApiData'
import { useInterval } from '../../../hooks/useInterval'
import { getEngineLogs } from '../../../services/admin'
import { getApiErrorMessage } from '../../../services/api'
import type { EngineLogsData } from '../../../types/admin'

const LINE_OPTIONS = [100, 200, 500]
const AUTO_REFRESH_MS = 5_000
/** Within this many px of the bottom still counts as "following the tail". */
const NEAR_BOTTOM_PX = 48

const BTN_GHOST =
  'inline-flex items-center gap-1.5 h-[34px] rounded-pill border border-border bg-surface2 px-3.5 text-[12.5px] font-semibold text-text transition-[border-color,color] duration-150 hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed'

/** ERROR → red, WARNING → amber (accent token), everything else muted. */
function lineClass(line: string): string {
  if (line.includes(' ERROR ')) return 'text-red'
  if (line.includes(' WARNING ')) return 'text-accent'
  return 'text-muted'
}

interface EngineLogCardProps {
  /** From engine status — false on local dev, where there is no journal. */
  available: boolean
  /** Bump to force a re-fetch (e.g. right after a restart). */
  refreshToken: number
}

/** journalctl tail with line-count chips, auto-refresh and smart follow. */
export default function EngineLogCard({
  available,
  refreshToken,
}: EngineLogCardProps) {
  const [lines, setLines] = useState(200)
  const [auto, setAuto] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  const { data, loading, error, reload } = useApiData<EngineLogsData>(
    () =>
      available
        ? getEngineLogs(lines)
        : Promise.resolve({ available: false, lines: [] }),
    [lines, refreshToken, available],
  )

  useInterval(reload, available && auto ? AUTO_REFRESH_MS : null)

  const paneRef = useRef<HTMLDivElement | null>(null)
  // Follow the tail only while the reader is already at/near the bottom —
  // never yank the scroll position while they are reading history.
  const nearBottomRef = useRef(true)

  const onPaneScroll = () => {
    const el = paneRef.current
    if (!el) return
    nearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
  }

  useEffect(() => {
    if (data) {
      setUpdatedAt(
        new Date().toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
        }),
      )
    }
    const el = paneRef.current
    if (el && nearBottomRef.current) el.scrollTop = el.scrollHeight
  }, [data])

  const unavailable = !available || (data !== null && !data.available)
  const logLines = data?.lines ?? []

  return (
    <section className={CARD} data-aos="fade-up" data-aos-delay="150">
      <div className={HEAD}>
        <div className={HEAD_L}>
          <span className={ICON_CHIP}>
            <ScrollText size={16} />
          </span>
          <div>
            <div className={CARD_TITLE}>Engine log</div>
            <div className={CARD_SUB}>
              Oldest → newest
              {updatedAt && !unavailable && ` · updated ${updatedAt}`}
            </div>
          </div>
        </div>

        {!unavailable && (
          <div className="flex flex-wrap items-center gap-2">
            {LINE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`${CHIP_BASE} ${lines === opt ? CHIP_ON : CHIP_OFF}`}
                onClick={() => {
                  nearBottomRef.current = true
                  setLines(opt)
                }}
              >
                {opt}
              </button>
            ))}
            <span className="w-px h-5 bg-border mx-1 max-sm:hidden" />
            <button
              type="button"
              className={`${CHIP_BASE} ${auto ? CHIP_ON : CHIP_OFF}`}
              onClick={() => setAuto((a) => !a)}
              aria-pressed={auto}
              title={auto ? 'Auto-refresh on (every 5s)' : 'Auto-refresh off'}
            >
              Auto <Power size={12} strokeWidth={2.75} />
            </button>
            <button
              type="button"
              className={BTN_GHOST}
              onClick={reload}
              disabled={loading}
            >
              <RefreshCw
                size={14}
                className={
                  loading ? 'animate-[dstate-spin_0.8s_linear_infinite]' : ''
                }
              />
              Refresh
            </button>
          </div>
        )}
      </div>

      {unavailable ? (
        <div className={NOTE_EMPTY}>
          Engine logs are available on the prod server only.
        </div>
      ) : (
        <>
          {error !== null && data !== null && (
            <div className={`${NOTE_ERROR} mb-3`}>
              <AlertTriangle size={15} className="flex-none mt-px" />
              <span>
                {getApiErrorMessage(error, 'Could not refresh the log.')}
              </span>
            </div>
          )}

          {/* Keyed on the selector only — replay the reveal when the line count
              changes, never on the 5s auto-refresh. */}
          <div key={`lines-${lines}`} className="animate-[fadeup_0.35s_ease-out]">
            <div
              ref={paneRef}
              onScroll={onPaneScroll}
              className="bg-surface2 border border-hair rounded-[10px] font-mono text-[12px] leading-[1.65] overflow-auto max-h-[480px] min-h-[240px] p-3.5 whitespace-pre-wrap break-words"
            >
              {logLines.length === 0 ? (
                <div className="grid place-items-center min-h-[208px] font-body text-[13px] text-muted">
                  {data === null
                    ? loading
                      ? 'Loading log…'
                      : getApiErrorMessage(error, 'Could not load the log.')
                    : 'No log lines yet.'}
                </div>
              ) : (
                logLines.map((line, i) => (
                  <div key={`${i}-${line}`} className={lineClass(line)}>
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

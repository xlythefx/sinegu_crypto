import { useCallback, type ReactNode } from 'react'
import {
  AtSign,
  Fingerprint,
  History,
  Megaphone,
  Monitor,
  Smartphone,
  Tablet,
  Bot,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react'
import DataState from '../../dashboard/DataState'
import { DiscordMark, TelegramMark } from '../../ui/BrandIcons'
import { useApiData } from '../../../hooks/useApiData'
import { getAdminUserSignupInfo } from '../../../services/admin'
import { fmtDateTime, formatDate } from '../../../lib/format'
import { SIGNUP_SOURCE_LABELS, telegramUrl } from '../../../lib/signupSources'
import {
  SIGNUP_INFO_SINCE,
  browserOs,
  consentLabel,
  countryName,
  deviceTypeLabel,
  methodLabel,
} from '../../../lib/accessEvents'
import type { AccessEvent, AdminSignupInfo, DeviceType } from '../../../types/signupInfo'

const CARD = 'flex flex-col rounded-card border border-border bg-surface p-card'
const CHIP =
  'grid h-7 w-7 flex-none place-items-center rounded-[9px] border border-accent-line bg-accent-soft text-accent'
const TILE = 'min-w-0 rounded-[12px] border border-border bg-surface2 px-3.5 py-3'
const TILE_LABEL = 'font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase'
const TILE_VALUE = 'mt-1 text-[13.5px] font-bold [overflow-wrap:anywhere]'
const MUTED_NOTE =
  'rounded-[10px] border border-dashed border-border bg-surface2 px-3.5 py-2.5 text-[12.5px] text-muted'
const TH = 'px-3 py-2.5 text-left font-mono text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase'
const TD = 'px-3 py-2.5 align-top text-[12.5px]'

const DEVICE_ICONS: Record<DeviceType, LucideIcon> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
  bot: Bot,
  unknown: HelpCircle,
}

function CardHead({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return (
    <div className="mb-3.5 flex items-center gap-2.5">
      <span className={CHIP}>{icon}</span>
      <div className="min-w-0">
        <div className="font-display text-[15px] font-extrabold">{title}</div>
        <div className="mt-px text-[12px] text-muted">{sub}</div>
      </div>
    </div>
  )
}

function Tile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className={TILE}>
      <div className={TILE_LABEL}>{label}</div>
      <div className={TILE_VALUE}>{value}</div>
      {sub && <div className="mt-0.5 text-[11.5px] text-muted [overflow-wrap:anywhere]">{sub}</div>}
    </div>
  )
}

const dash = <span className="font-normal text-faint">—</span>

function Country({ code }: { code: string | null }) {
  if (!code) return dash
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="rounded-[5px] border border-border px-1 font-mono text-[10.5px] text-muted">{code}</span>
      {countryName(code)}
    </span>
  )
}

function Device({ event }: { event: AccessEvent }) {
  const Icon = DEVICE_ICONS[event.device_type] ?? HelpCircle
  return (
    <span className="inline-flex items-start gap-1.5">
      <Icon size={14} className="mt-[2px] shrink-0 text-muted" />
      <span>
        {deviceTypeLabel(event.device_type)}
        {browserOs(event) && <span className="font-normal text-muted"> · {browserOs(event)}</span>}
      </span>
    </span>
  )
}

/**
 * User detail → "Sign-up info": where they heard about us, their Telegram /
 * Discord, the sign-up's own fingerprint (IP, country, device) and every
 * sign-in since. Every staff role sees it — the owner's call, IP included.
 */
export default function UserSignupTab({ uniId }: { uniId: string }) {
  const fetchInfo = useCallback(() => getAdminUserSignupInfo(uniId), [uniId])
  const { data, loading, error, reload } = useApiData(fetchInfo, [fetchInfo])

  if (!data) {
    return <DataState loading={loading} error={error} onRetry={reload} label="sign-up info" />
  }

  return (
    <div className="flex flex-col gap-stack">
      <div className="grid grid-cols-2 gap-stack max-[1100px]:grid-cols-1">
        <SourcesCard info={data} />
        <ContactCard info={data} />
      </div>
      <FingerprintCard info={data} />
      <HistoryCard events={data.events} />
    </div>
  )
}

function SourcesCard({ info }: { info: AdminSignupInfo }) {
  const { sources, first } = info.signup
  return (
    <section className={CARD}>
      <CardHead
        icon={<Megaphone size={15} />}
        title="How they found us"
        sub="Ticked on the sign-up form (optional)"
      />
      {sources.length ? (
        <div className="flex flex-wrap gap-2">
          {sources.map(({ source, detail }) => (
            <span
              key={source}
              className="inline-flex max-w-full items-center gap-1.5 rounded-pill border border-accent-line bg-accent-soft px-3 py-1.5 text-[12.5px] font-semibold text-accent"
            >
              {SIGNUP_SOURCE_LABELS[source] ?? source}
              {detail && <span className="font-normal text-text [overflow-wrap:anywhere]">: {detail}</span>}
            </span>
          ))}
        </div>
      ) : (
        <p className={MUTED_NOTE}>
          {first
            ? 'Nothing ticked — the question is optional.'
            : `Signed up before this question was asked (${formatDate(SIGNUP_INFO_SINCE)}).`}
        </p>
      )}
    </section>
  )
}

function ContactCard({ info }: { info: AdminSignupInfo }) {
  const { telegram, discord, discord_linked } = info.signup.contacts
  return (
    <section className={CARD}>
      <CardHead
        icon={<AtSign size={15} />}
        title="Telegram & Discord"
        sub="Typed by the user — only a linked Discord is confirmed"
      />
      <div className="flex flex-col gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5 text-[13px]">
          <span className="shrink-0 text-[#229ED9]">
            <TelegramMark size={17} />
          </span>
          {telegram ? (
            <a
              href={telegramUrl(telegram)}
              target="_blank"
              rel="noreferrer"
              className="truncate font-mono font-bold text-text hover:underline"
            >
              @{telegram}
            </a>
          ) : (
            <span className="text-faint">No Telegram given</span>
          )}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2.5 text-[13px]">
          <span className="shrink-0 text-[#5865F2]">
            <DiscordMark size={17} />
          </span>
          {discord_linked ? (
            <>
              <span className="truncate font-mono font-bold">@{discord_linked}</span>
              <span className="rounded-pill border border-[rgba(47,214,122,0.35)] bg-[rgba(47,214,122,0.08)] px-2 py-0.5 text-[11px] font-bold text-green">
                Linked
              </span>
            </>
          ) : discord ? (
            <span className="truncate font-mono font-bold">@{discord}</span>
          ) : (
            <span className="text-faint">No Discord given</span>
          )}
          {discord_linked && discord && discord !== discord_linked && (
            <span className="text-[11.5px] text-muted">typed at sign-up: @{discord}</span>
          )}
        </div>
      </div>
    </section>
  )
}

function FingerprintCard({ info }: { info: AdminSignupInfo }) {
  const { first, registered_at, method } = info.signup
  return (
    <section className={CARD}>
      <CardHead
        icon={<Fingerprint size={15} />}
        title="Sign-up"
        sub="Where and on what the account was created"
      />
      {!first ? (
        <p className={MUTED_NOTE}>
          {registered_at ? `Signed up ${fmtDateTime(registered_at)} — ` : ''}
          before sign-up details were recorded ({formatDate(SIGNUP_INFO_SINCE)}). Later sign-ins
          appear below.
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-2.5 max-[1300px]:grid-cols-3 max-[900px]:grid-cols-2 max-[480px]:grid-cols-1">
          <Tile label="Signed up" value={fmtDateTime(first.created_at)} sub={`via ${methodLabel(method)}`} />
          <Tile label="IP address" value={first.ip ? <span className="font-mono">{first.ip}</span> : dash} />
          <Tile label="Country" value={<Country code={first.country} />} sub="from the IP (Cloudflare)" />
          <Tile label="Device" value={<Device event={first} />} />
          <Tile label="Time zone" value={first.timezone ?? dash} />
          <Tile label="Language" value={first.language ?? dash} />
          <Tile label="Screen" value={first.screen ? <span className="font-mono">{first.screen}</span> : dash} />
          <Tile
            label="Privacy choice"
            value={consentLabel(first.consent)}
            sub={first.consent === 'all' ? undefined : 'time zone, language and screen not shared'}
          />
        </div>
      )}
    </section>
  )
}

function HistoryCard({ events }: { events: AccessEvent[] }) {
  return (
    <section className={CARD}>
      <CardHead
        icon={<History size={15} />}
        title="Sign-in history"
        sub="The sign-up and every sign-in since, newest first (last 25)"
      />
      {events.length === 0 ? (
        <p className={MUTED_NOTE}>No sign-ins recorded since {formatDate(SIGNUP_INFO_SINCE)}.</p>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={TH}>When</th>
                <th className={TH}>What</th>
                <th className={TH}>IP address</th>
                <th className={TH}>Country</th>
                <th className={TH}>Device</th>
                <th className={TH}>Time zone</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-hair last:border-b-0">
                  <td className={`${TD} whitespace-nowrap`}>{fmtDateTime(e.created_at)}</td>
                  <td className={`${TD} whitespace-nowrap`}>
                    <span className={e.event === 'register' ? 'font-bold text-accent' : ''}>
                      {e.event === 'register' ? 'Sign-up' : 'Sign-in'}
                    </span>
                    <span className="text-muted"> · {methodLabel(e.method)}</span>
                  </td>
                  <td className={`${TD} font-mono`}>{e.ip ?? dash}</td>
                  <td className={TD}>
                    <Country code={e.country} />
                  </td>
                  <td className={TD} title={e.user_agent ?? undefined}>
                    <Device event={e} />
                  </td>
                  <td className={`${TD} text-muted`}>{e.timezone ?? dash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

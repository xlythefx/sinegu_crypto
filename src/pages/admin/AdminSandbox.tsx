import { useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  AlertCircle,
  CheckCircle2,
  FlaskConical,
  Plus,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import ConfirmModal from '../../components/ui/ConfirmModal'
import {
  SandboxPositionModal,
  SandboxUserModal,
} from '../../components/admin/SandboxModals'
import SandboxInvoiceCard from '../../components/admin/SandboxInvoiceCard'
import { useApiData } from '../../hooks/useApiData'
import {
  clearSandboxPositions,
  deleteSandboxUser,
  getAdminUsers,
  getSandboxUsers,
} from '../../services/admin'
import { ApiError, getApiErrorMessage } from '../../services/api'
import { fmtMediumDate } from '../../lib/format'
import type { SandboxUser, UserStatus } from '../../types/admin'

/* ---- shared token-mapped class strings (was AdminSandbox.css) ---- */
const CHIP =
  'w-7 h-7 flex-none grid place-items-center rounded-[9px] bg-accent-soft border border-accent-line text-accent'
const MSG =
  'flex items-start gap-2 rounded-[10px] border py-2.5 px-[13px] text-[12.5px] leading-[1.5]'
const MSG_OK =
  'border-[color-mix(in_srgb,var(--green)_35%,transparent)] bg-[color-mix(in_srgb,var(--green)_8%,transparent)] text-green'
const MSG_ERR =
  'border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] text-red'
const BTN =
  'inline-flex items-center gap-[7px] h-10 rounded-pill border border-transparent px-[18px] text-[13px] font-bold cursor-pointer transition-[filter,border-color,background,opacity] duration-150 disabled:opacity-[0.55] disabled:cursor-not-allowed'
const BTN_GHOST = 'bg-surface2 border-border text-text enabled:hover:border-accent'
const BTN_DANGER =
  'bg-transparent border-[color-mix(in_srgb,var(--red)_40%,transparent)] text-red enabled:hover:bg-[color-mix(in_srgb,var(--red)_10%,transparent)]'
const BTN_SM = 'h-8 px-3 text-[12px]'
const CARD_HEAD = 'flex items-start gap-3 mb-[18px]'
const CARD_TITLE = 'font-display text-[15px] font-extrabold'
const CARD_SUB = 'text-[12px] text-muted mt-px'

const BADGE_BASE =
  'inline-flex items-center rounded-pill border py-[3px] px-2.5 text-[11px] font-bold whitespace-nowrap'
const BADGE_TONE: Record<UserStatus, string> = {
  active:
    'bg-[color-mix(in_srgb,var(--green)_12%,transparent)] border-[color-mix(in_srgb,var(--green)_35%,transparent)] text-green',
  pending: 'bg-accent-soft border-accent-line text-accent',
  suspended:
    'bg-[color-mix(in_srgb,var(--red)_10%,transparent)] border-[color-mix(in_srgb,var(--red)_35%,transparent)] text-red',
}

/** Combined loader — sandbox users (cleanup list) + all users (insert target). */
const fetchSandbox = () =>
  Promise.all([getSandboxUsers(), getAdminUsers()]).then(
    ([sandbox, users]) => ({ sandbox, users }),
  )

function StatusBadge({ status }: { status: UserStatus }) {
  return (
    <span className={`${BADGE_BASE} ${BADGE_TONE[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export default function AdminSandbox() {
  const { data, loading, error, reload } = useApiData(fetchSandbox)

  const [userModal, setUserModal] = useState(false)
  const [posModal, setPosModal] = useState(false)
  const [banner, setBanner] = useState<ReactNode | null>(null)

  /* ---- cleanup confirmations ---- */
  const [cleanup, setCleanup] = useState<{
    user: SandboxUser
    kind: 'clear' | 'delete'
  } | null>(null)
  const [cleanupBusy, setCleanupBusy] = useState(false)
  const [cleanupErr, setCleanupErr] = useState<string | null>(null)

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  if (!data) {
    return (
      <AdminLayout title="Sandbox" subtitle="Create test data to exercise the platform.">
        <DataState
          loading={loading}
          error={error}
          onRetry={reload}
          label="sandbox users"
        />
      </AdminLayout>
    )
  }

  const { sandbox, users } = data

  const runCleanup = async () => {
    if (!cleanup) return
    setCleanupBusy(true)
    setCleanupErr(null)
    try {
      if (cleanup.kind === 'clear') {
        await clearSandboxPositions(cleanup.user.uni_id)
      } else {
        await deleteSandboxUser(cleanup.user.uni_id)
      }
      setCleanup(null)
      reload()
    } catch (err) {
      setCleanupErr(
        getApiErrorMessage(
          err,
          cleanup.kind === 'clear'
            ? 'Could not clear positions.'
            : 'Could not delete the user.',
        ),
      )
      setCleanup(null)
    } finally {
      setCleanupBusy(false)
    }
  }

  return (
    <AdminLayout title="Sandbox" subtitle="Create test data to exercise the platform.">
      {/* ============ launchers ============ */}
      <section
        className="grid grid-cols-2 max-[720px]:grid-cols-1 gap-4 mb-4"
        data-aos="fade-up"
      >
        {[
          {
            icon: <UserPlus size={17} />,
            title: 'Create Test User',
            sub: 'Spin up a throwaway account for the approve / reject flow.',
            onClick: () => setUserModal(true),
          },
          {
            icon: <FlaskConical size={17} />,
            title: 'Insert Past Position',
            sub: 'Add fabricated closed trades to exercise statistics.',
            onClick: () => setPosModal(true),
          },
        ].map((tile) => (
          <button
            key={tile.title}
            type="button"
            className="flex items-center gap-3.5 min-w-0 text-left rounded-card border border-border bg-surface p-[18px] cursor-pointer transition-[border-color,background,transform] duration-150 hover:border-accent-line hover:bg-[linear-gradient(160deg,var(--accentSoft),var(--surface))] hover:-translate-y-px"
            onClick={tile.onClick}
          >
            <span className={CHIP}>{tile.icon}</span>
            <span className="flex flex-col gap-[3px] min-w-0">
              <span className="font-display text-[15px] font-extrabold text-text">
                {tile.title}
              </span>
              <span className="text-[12px] text-muted leading-[1.45]">
                {tile.sub}
              </span>
            </span>
            <Plus size={16} className="ml-auto flex-none text-accent" />
          </button>
        ))}
      </section>

      {/* ============ success banner ============ */}
      {banner && (
        <div className="flex items-stretch gap-2 mb-4" data-aos="fade-up">
          <div className={`${MSG} ${MSG_OK} flex-1`} role="status">
            <CheckCircle2 size={15} className="flex-none mt-px" />
            <span>{banner}</span>
          </div>
          <button
            type="button"
            className="flex-none inline-flex items-center justify-center w-[34px] rounded-[10px] border border-border bg-surface2 text-muted cursor-pointer transition-[border-color,color] duration-150 hover:border-accent hover:text-text"
            aria-label="Dismiss"
            onClick={() => setBanner(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ============ cleanup ============ */}
      <section
        className="rounded-card border border-border bg-surface p-card mb-[18px]"
        data-aos="fade-up"
        data-aos-delay="60"
      >
        <div className={CARD_HEAD}>
          <span className={CHIP}>
            <Trash2 size={16} />
          </span>
          <div className="min-w-0">
            <div className={CARD_TITLE}>Cleanup</div>
            <div className={CARD_SUB}>Only sandbox-tagged users appear here.</div>
          </div>
        </div>

        {cleanupErr && (
          <div className={`${MSG} ${MSG_ERR} mb-3`} role="alert">
            <AlertCircle size={15} className="flex-none mt-px" />
            <span>{cleanupErr}</span>
          </div>
        )}

        {sandbox.length === 0 ? (
          <div className="py-7 px-3 text-center text-[13px] text-muted">
            No sandbox users yet — create one above.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {sandbox.map((u) => (
              <div
                className="flex flex-wrap items-center gap-3.5 rounded-[12px] border border-hair bg-surface2 py-3 px-4"
                key={u.uni_id}
              >
                <div className="flex flex-col gap-0.5 min-w-[160px] flex-[1_1_200px]">
                  <span className="text-[13.5px] font-bold text-text">
                    {u.name || '—'}
                  </span>
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-muted">
                    {u.email}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <StatusBadge status={u.status} />
                  <span className="font-mono text-[11.5px] text-muted whitespace-nowrap">
                    {u.created_at ? fmtMediumDate(u.created_at) : '—'}
                  </span>
                  <span className="inline-flex items-center gap-[5px] rounded-pill border border-border bg-surface py-[3px] px-2.5 font-mono text-[11.5px] font-bold text-muted whitespace-nowrap">
                    {u.positions_count} position
                    {u.positions_count === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    className={`${BTN} ${BTN_GHOST} ${BTN_SM}`}
                    disabled={cleanupBusy}
                    onClick={() => setCleanup({ user: u, kind: 'clear' })}
                  >
                    Clear positions
                  </button>
                  <button
                    type="button"
                    className={`${BTN} ${BTN_DANGER} ${BTN_SM}`}
                    disabled={cleanupBusy}
                    onClick={() => setCleanup({ user: u, kind: 'delete' })}
                  >
                    <Trash2 size={13} />
                    Delete user
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ============ invoice testing ============ */}
      <SandboxInvoiceCard users={users} />

      {/* ============ modals ============ */}
      <SandboxUserModal
        open={userModal}
        onClose={() => setUserModal(false)}
        onSuccess={(user) => {
          setUserModal(false)
          reload()
          setBanner(
            <>
              Created {user.email} ({user.status}). Pending users show up in{' '}
              <Link className="text-inherit font-bold underline" to="/admin/users">
                User Management
              </Link>{' '}
              for approve / reject.
            </>,
          )
        }}
      />
      <SandboxPositionModal
        open={posModal}
        users={users}
        onClose={() => setPosModal(false)}
        onSuccess={(msg) => {
          setPosModal(false)
          reload()
          setBanner(msg)
        }}
      />

      <ConfirmModal
        open={cleanup !== null}
        title={
          cleanup?.kind === 'clear'
            ? `Clear positions for ${cleanup?.user.name || 'user'}?`
            : `Delete ${cleanup?.user.name || 'user'}?`
        }
        message={
          cleanup?.kind === 'clear'
            ? 'All fabricated past positions for this test user will be removed. This cannot be undone.'
            : 'This test user and their data will be permanently removed. This cannot be undone.'
        }
        confirmLabel={
          cleanupBusy
            ? 'Working…'
            : cleanup?.kind === 'clear'
              ? 'Yes, clear'
              : 'Yes, delete'
        }
        cancelLabel="No"
        danger
        onConfirm={runCleanup}
        onCancel={() => setCleanup(null)}
      />
    </AdminLayout>
  )
}

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
import './AdminSandbox.css'

/** Combined loader — sandbox users (cleanup list) + all users (insert target). */
const fetchSandbox = () =>
  Promise.all([getSandboxUsers(), getAdminUsers()]).then(
    ([sandbox, users]) => ({ sandbox, users }),
  )

function StatusBadge({ status }: { status: UserStatus }) {
  return (
    <span className={`asbx-badge asbx-badge--${status}`}>
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
      <section className="asbx-launch" data-aos="fade-up">
        <button
          type="button"
          className="asbx-launch__tile"
          onClick={() => setUserModal(true)}
        >
          <span className="dchip asbx-launch__icon">
            <UserPlus size={17} />
          </span>
          <span className="asbx-launch__text">
            <span className="asbx-launch__title">Create Test User</span>
            <span className="asbx-launch__sub">
              Spin up a throwaway account for the approve / reject flow.
            </span>
          </span>
          <Plus size={16} className="asbx-launch__plus" />
        </button>

        <button
          type="button"
          className="asbx-launch__tile"
          onClick={() => setPosModal(true)}
        >
          <span className="dchip asbx-launch__icon">
            <FlaskConical size={17} />
          </span>
          <span className="asbx-launch__text">
            <span className="asbx-launch__title">Insert Past Position</span>
            <span className="asbx-launch__sub">
              Add fabricated closed trades to exercise statistics.
            </span>
          </span>
          <Plus size={16} className="asbx-launch__plus" />
        </button>
      </section>

      {/* ============ success banner ============ */}
      {banner && (
        <div className="asbx-banner" data-aos="fade-up">
          <div className="asbx-msg asbx-msg--ok" role="status">
            <CheckCircle2 size={15} />
            <span>{banner}</span>
          </div>
          <button
            type="button"
            className="asbx-banner__close"
            aria-label="Dismiss"
            onClick={() => setBanner(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ============ cleanup ============ */}
      <section className="dcard asbx-cleanup" data-aos="fade-up" data-aos-delay="60">
        <div className="asbx-card__head">
          <span className="dchip">
            <Trash2 size={16} />
          </span>
          <div className="asbx-card__head-text">
            <div className="dcard__title">Cleanup</div>
            <div className="dcard__sub">
              Only sandbox-tagged users appear here.
            </div>
          </div>
        </div>

        {cleanupErr && (
          <div className="asbx-msg asbx-msg--err asbx-cleanup__err" role="alert">
            <AlertCircle size={15} />
            <span>{cleanupErr}</span>
          </div>
        )}

        {sandbox.length === 0 ? (
          <div className="asbx-empty">
            No sandbox users yet — create one above.
          </div>
        ) : (
          <div className="asbx-users">
            {sandbox.map((u) => (
              <div className="asbx-user" key={u.uni_id}>
                <div className="asbx-user__id">
                  <span className="asbx-user__name">{u.name || '—'}</span>
                  <span className="asbx-user__email">{u.email}</span>
                </div>
                <div className="asbx-user__meta">
                  <StatusBadge status={u.status} />
                  <span className="asbx-user__date">
                    {u.created_at ? fmtMediumDate(u.created_at) : '—'}
                  </span>
                  <span className="asbx-pos-chip">
                    {u.positions_count} position
                    {u.positions_count === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="asbx-user__actions">
                  <button
                    type="button"
                    className="asbx-btn asbx-btn--ghost asbx-btn--sm"
                    disabled={cleanupBusy}
                    onClick={() => setCleanup({ user: u, kind: 'clear' })}
                  >
                    Clear positions
                  </button>
                  <button
                    type="button"
                    className="asbx-btn asbx-btn--danger asbx-btn--sm"
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
              <Link className="asbx-msg__link" to="/admin/users">
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

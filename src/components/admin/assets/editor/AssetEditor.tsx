import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft } from 'lucide-react'
import AssetPreview from './AssetPreview'
import EditorActionBar from './EditorActionBar'
import IdentitySection from './IdentitySection'
import SizingSection from './SizingSection'
import StreakSection from './StreakSection'
import TradingSection from './TradingSection'
import BinanceSizingCheck from '../BinanceSizingCheck'
import ConfirmModal from '../../../ui/ConfirmModal'
import { useAssetDraft } from '../../../../hooks/useAssetDraft'
import { useAssetImage } from '../../../../hooks/useAssetImage'
import { useBinanceSizingCheck } from '../../../../hooks/useBinanceSizingCheck'
import {
  changesSizing,
  draftBase,
  draftMax,
  draftToInput,
  isBinanceDraft,
  type DraftProblem,
} from '../../../../lib/assetDraft'
import { displaySymbol } from '../../../../lib/chart'
import { isKilled } from '../../../../lib/killSwitch'
import { getApiErrorMessage } from '../../../../services/api'
import type { AssetImageChange } from '../../../../services/admin'
import type { AdminAsset, AssetInput } from '../../../../types/admin'

interface AssetEditorProps {
  /** null = a new coin. Mount keyed by asset id: the draft is read once. */
  asset: AdminAsset | null
  /** New coin only: the exchange it opens on (the section's "Add coin" button). */
  defaultBroker: string | null
  /** Writes the asset; throws on a refusal. The page navigates on success. */
  onSave: (input: AssetInput, image: AssetImageChange) => Promise<void>
  /** Back to the list, nothing saved. */
  onLeave: () => void
}

const SECTION_ANCHOR: Record<DraftProblem['section'], string> = {
  identity: 'asset-identity',
  sizing: 'asset-sizing',
  streak: 'asset-streak',
}

/**
 * Admin → Trading Assets → New / Edit coin. Was a 480px modal; it outgrew it
 * once the Binance check and the streak ladder joined the sizes.
 *
 * Wide screens: the form on the left, a sticky preview + the Binance check on
 * the right, beside the numbers they react to. Phones: one column, the preview
 * placed right after Sizing for the same reason. Every save is confirmed
 * (ConfirmModal), as on every admin write.
 */
export default function AssetEditor({ asset, defaultBroker, onSave, onLeave }: AssetEditorProps) {
  const creating = asset === null
  const { draft, update, problems, changed: draftChanged } = useAssetDraft(asset, defaultBroker)
  const image = useAssetImage(asset?.asset_image ?? null)
  const changed = draftChanged || image.changed
  const binance = isBinanceDraft(draft)
  const check = useBinanceSizingCheck(binance ? draft.ticker : null)

  const [showProblems, setShowProblems] = useState(false)
  const [streakOpen, setStreakOpen] = useState(
    () => draft.streakEnabled || draft.kill.on,
  )
  const [pending, setPending] = useState<AssetInput | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // A reload or a closed tab with unsaved work asks first (the browser words it).
  useEffect(() => {
    if (!changed || saving) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [changed, saving])

  const showProblem = (p: DraftProblem) => {
    if (p.section === 'streak') setStreakOpen(true)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    requestAnimationFrame(() =>
      document
        .getElementById(SECTION_ANCHOR[p.section])
        ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }),
    )
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setShowProblems(true)
    setSaveError(null)
    if (problems.length > 0) {
      showProblem(problems[0])
      return
    }
    setPending(draftToInput(draft))
  }

  const confirmSave = async () => {
    if (!pending) return
    setSaving(true)
    try {
      await onSave(pending, image.change)
    } catch (err) {
      setSaveError(getApiErrorMessage(err, 'Could not save the asset.'))
    } finally {
      setSaving(false)
      setPending(null)
    }
  }

  const leave = () => (changed ? setLeaving(true) : onLeave())

  const streakProblem = showProblems ? problems.find((p) => p.section === 'streak')?.message ?? null : null
  const revives = asset !== null && isKilled(asset) && pending?.enabled === true
  const name = draft.ticker.trim() ? displaySymbol(draft.ticker.trim()) : 'New coin'
  const where = draft.broker ? ` on ${draft.broker}` : ''

  const confirmMessage = creating
    ? `This adds ${pending?.ticker || 'the coin'}${where}. ${
        pending?.enabled ? 'Its signals start trading straight away.' : 'It stays off until you switch it on.'
      }`
    : `This updates ${asset.ticker}${where}.${
        pending && changesSizing(asset, pending)
          ? ' If the main account has this coin open, the new size waits for that position to close; otherwise it applies from the next signal.'
          : ''
      }${
        revives
          ? ' It also turns the coin back on: new trades start on the next signal, and the kill switch counts the master’s losses again from now.'
          : ''
      }`

  return (
    <form onSubmit={submit} noValidate>
      <div className="mx-auto max-w-[1200px]">
        <header className="mb-stack flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={leave}
            className="inline-flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-btn border border-border bg-surface text-muted transition-colors duration-150 hover:border-accent hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label="Back to Trading Assets"
          >
            <ArrowLeft size={17} aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-muted">Trading Assets</p>
            <h1 className="truncate font-display text-[22px] font-extrabold leading-tight">
              {creating ? `New coin${draft.ticker.trim() ? `: ${name}` : ''}` : `Edit ${name}`}
              {draft.broker && <span className="text-muted">{where}</span>}
            </h1>
          </div>
        </header>

        <div className="grid gap-stack [grid-template-areas:'top'_'aside'_'bottom'] lg:grid-cols-[minmax(0,1fr)_minmax(320px,390px)] lg:[grid-template-areas:'top_aside'_'bottom_aside']">
          <div className="flex min-w-0 flex-col gap-stack [grid-area:top]">
            <IdentitySection draft={draft} update={update} image={image} showErrors={showProblems} />
            <SizingSection draft={draft} update={update} asset={asset} showErrors={showProblems} />
          </div>

          {/* Scrolls on its own once it is taller than the screen, so the
              bottom of the Binance check is never stuck under the save bar. */}
          <aside className="flex min-w-0 flex-col gap-stack [grid-area:aside] lg:sticky lg:top-6 lg:max-h-[calc(100dvh-7.5rem)] lg:self-start lg:overflow-y-auto lg:[scrollbar-width:thin]">
            <AssetPreview draft={draft} asset={asset} image={image.shown} />
            {binance && (
              <BinanceSizingCheck
                ticker={draft.ticker}
                baseSize={draftBase(draft) > 0 ? draftBase(draft) : 0}
                maxPosition={draftMax(draft)}
                check={check}
                onUseBase={(b) => update({ baseSize: String(b) })}
              />
            )}
          </aside>

          <div className="flex min-w-0 flex-col gap-stack [grid-area:bottom]">
            <TradingSection draft={draft} update={update} asset={asset} />
            <StreakSection
              draft={draft}
              update={update}
              asset={asset}
              open={streakOpen}
              onToggle={() => setStreakOpen((o) => !o)}
              error={streakProblem}
              saving={saving}
            />
            {saveError && (
              <p
                className="rounded-row border border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] px-4 py-3 text-[13px] text-red"
                role="alert"
              >
                {saveError}
              </p>
            )}
          </div>
        </div>
      </div>

      <EditorActionBar
        creating={creating}
        saving={saving}
        changed={changed}
        problems={problems}
        showProblems={showProblems}
        onCancel={leave}
        onShowProblem={showProblem}
      />

      <ConfirmModal
        open={pending !== null}
        title={creating ? `Create ${pending?.ticker ?? 'coin'}?` : 'Save changes?'}
        message={confirmMessage}
        confirmLabel={creating ? 'Yes, create' : 'Yes, save'}
        cancelLabel="No"
        onConfirm={confirmSave}
        onCancel={() => setPending(null)}
      />

      <ConfirmModal
        open={leaving}
        title="Leave without saving?"
        message="Your changes on this page will be lost."
        confirmLabel="Leave"
        cancelLabel="Keep editing"
        danger
        onConfirm={() => {
          setLeaving(false)
          onLeave()
        }}
        onCancel={() => setLeaving(false)}
      />
    </form>
  )
}

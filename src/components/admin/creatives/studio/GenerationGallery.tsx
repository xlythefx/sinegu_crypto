import { Images, LoaderCircle, RefreshCw } from 'lucide-react'
import DataState from '../../../dashboard/DataState'
import type { CreativeGenerationsState } from '../../../../hooks/useCreativeGenerations'
import type { CreativeGeneration } from '../../../../types/creatives'
import SectionHeader from '../SectionHeader'
import { BTN_SOFT, SECTION } from '../creativeClasses'
import GenerationCard from './GenerationCard'

interface GenerationGalleryProps {
  state: CreativeGenerationsState
  now: number
  retentionDays: number
  onDownload: (generation: CreativeGeneration, index: number) => Promise<string | null>
  onAnimate: (generation: CreativeGeneration, index: number) => void
  onUseAsRef: (generation: CreativeGeneration, index: number) => Promise<{ ok: boolean; message: string }>
  onCancel: (generation: CreativeGeneration) => void
  delay?: number
}

/**
 * Everything the team has generated, newest first, with "Load more" for
 * older ones. While anything is still with Higgsfield the list re-reads
 * itself every 5 seconds (only while this tab is on screen).
 */
export default function GenerationGallery({
  state,
  now,
  retentionDays,
  onDownload,
  onAnimate,
  onUseAsRef,
  onCancel,
  delay,
}: GenerationGalleryProps) {
  const { generations, hasMore, loading, error, reload, refresh, loadMore, loadingMore, moreError, pending } = state

  return (
    <section className={SECTION} data-aos="fade-up" data-aos-delay={delay} aria-labelledby="creatives-gallery">
      <SectionHeader
        icon={Images}
        id="creatives-gallery"
        title="Gallery"
        subtitle={`Newest first. Higgsfield keeps each result for ${retentionDays} days and then deletes it — download what you want to keep.`}
        actions={
          <>
            {pending && (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent" role="status">
                <LoaderCircle size={13} aria-hidden="true" className="animate-spin" />
                Checking every 5 s
              </span>
            )}
            <button
              type="button"
              onClick={refresh}
              aria-label="Refresh the gallery"
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-btn border border-border bg-surface text-muted transition-[border-color,color] duration-150 hover:border-accent hover:text-accent"
            >
              <RefreshCw size={14} aria-hidden="true" className={loading ? 'animate-spin' : undefined} />
            </button>
          </>
        }
      />

      {!generations ? (
        <DataState loading={loading} error={error} onRetry={reload} label="gallery" />
      ) : generations.length === 0 ? (
        <p className="rounded-row border border-dashed border-border px-4 py-10 text-center text-[13px] leading-[1.6] text-muted">
          Nothing generated yet. Start with “Image from text” — the cheapest way to try out ideas for the character.
        </p>
      ) : (
        <div className="@container">
          <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @5xl:grid-cols-3">
            {generations.map((g) => (
              <GenerationCard
                key={g.id}
                generation={g}
                now={now}
                retentionDays={retentionDays}
                onDownload={onDownload}
                onAnimate={onAnimate}
                onUseAsRef={onUseAsRef}
                onCancel={onCancel}
              />
            ))}
          </div>
        </div>
      )}

      {moreError && <p className="text-[12.5px] text-red">{moreError}</p>}
      {generations && hasMore && (
        <div className="flex justify-center">
          <button type="button" className={`${BTN_SOFT} px-5`} onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </section>
  )
}

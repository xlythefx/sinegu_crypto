import { useCallback } from 'react'
import { MessagesSquare, Users } from 'lucide-react'
import DataState from '../../../../dashboard/DataState'
import { useApiData } from '../../../../../hooks/useApiData'
import { fmtDateTime } from '../../../../../lib/format'
import { getTeamChats } from '../../../../../services/creativesAgent'
import CreativeModal from '../../CreativeModal'

interface TeamChatsModalProps {
  open: boolean
  onClose: () => void
  /** The chat on screen (marked). */
  currentId: string | null
  /** A video's editor chats instead of the workspace chats. */
  videoId?: number
  onOpen: (id: string) => void
}

/**
 * Chats are shared by the whole team (2026-11-17): every live chat, newest
 * first, with who started it, who has written in it and the latest message.
 * Opening one continues it — the assistant answers one person at a time.
 */
export default function TeamChatsModal({ open, onClose, currentId, videoId, onOpen }: TeamChatsModalProps) {
  const fetch = useCallback(() => getTeamChats({ videoId }), [videoId])
  if (!open) return null
  return (
    <CreativeModal
      open
      title={videoId ? 'This video’s chats' : 'Team chats'}
      subtitle="Everyone on the team sees every chat. Open one to read it or carry on — each message shows who wrote it."
      onClose={onClose}
      maxWidth={560}
    >
      <ChatList fetch={fetch} currentId={currentId} onOpen={onOpen} />
    </CreativeModal>
  )
}

function ChatList({ fetch, currentId, onOpen }: { fetch: () => ReturnType<typeof getTeamChats>; currentId: string | null; onOpen: (id: string) => void }) {
  const { data, loading, error, reload } = useApiData(fetch, [fetch])
  if (!data) return <DataState loading={loading} error={error} onRetry={reload} label="chats" />
  if (data.length === 0) {
    return <p className="rounded-row border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted">No chats in the last 7 days.</p>
  }
  return (
    <ol className="flex flex-col gap-2">
      {data.map((c) => {
        const on = c.id === currentId
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onOpen(c.id)}
              aria-current={on ? 'true' : undefined}
              className={`flex w-full min-w-0 cursor-pointer flex-col gap-1.5 rounded-row border px-3.5 py-3 text-left transition-[border-color,background] duration-150 hover:border-accent-line ${
                on ? 'border-accent bg-accent-soft' : 'border-hair bg-surface2/60'
              }`}
            >
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <MessagesSquare size={14} aria-hidden="true" className="flex-none text-accent" />
                <span className="min-w-0 text-[13px] font-bold text-text">Started by {c.started_by ?? 'someone'}</span>
                {on && <span className="text-[11px] font-bold text-accent">Open now</span>}
                {c.answering && <span className="text-[11px] font-semibold text-accent">· answering {c.answering}</span>}
              </span>
              {c.last_text ? (
                <span className="line-clamp-2 text-[12.5px] leading-[1.5] text-muted [overflow-wrap:anywhere]">
                  <span className="font-semibold text-text">{c.last_author ?? 'Someone'}:</span> {c.last_text}
                </span>
              ) : (
                <span className="text-[12.5px] text-faint">Nothing written yet.</span>
              )}
              <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10.5px] text-faint">
                {c.updated_at && <span>{fmtDateTime(c.updated_at)}</span>}
                <span>
                  {c.messages} {c.messages === 1 ? 'message' : 'messages'}
                </span>
                {c.people.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Users size={10} aria-hidden="true" />
                    {c.people.join(', ')}
                  </span>
                )}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

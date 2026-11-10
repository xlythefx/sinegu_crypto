import { useState } from 'react'
import { Lightbulb } from 'lucide-react'
import DataState from '../../../dashboard/DataState'
import { useApiData } from '../../../../hooks/useApiData'
import { getCreativeCharacter } from '../../../../services/creatives'
import type { CreativeCharacter } from '../../../../types/creatives'
import CharacterForm from './CharacterForm'
import CharacterRefs from './CharacterRefs'

interface CharacterTabProps {
  maxReferences: number
  /** Jump to Studio (the "how to start" line links there). */
  onOpenStudio: () => void
}

/**
 * The one avatar every post uses: who it is in words, and the pictures that
 * show it. Both are sent with every character generation, which is what keeps
 * it looking the same from one video to the next.
 */
export default function CharacterTab({ maxReferences, onOpenStudio }: CharacterTabProps) {
  const { data, loading, error, reload } = useApiData(getCreativeCharacter)
  const [override, setCharacter] = useState<CreativeCharacter | null>(null)
  const character = override ?? data

  if (!character) {
    return <DataState loading={loading} error={error} onRetry={reload} label="character" />
  }

  return (
    <div className="flex flex-col gap-stack">
      <div
        className="flex items-start gap-3 rounded-row border border-accent-line bg-[linear-gradient(160deg,var(--accentSoft),var(--surface))] px-4 py-3.5"
        data-aos="fade-up"
      >
        <Lightbulb size={17} aria-hidden="true" className="mt-0.5 flex-none text-accent" />
        <div className="min-w-0 text-[12.5px] leading-[1.6] text-muted">
          <p className="font-bold text-text">How {character.name} stays the same in every post</p>
          <p className="mt-0.5">
            These pictures and words are sent with every character image and video. To start, make candidates with
            “Image from text” in{' '}
            <button
              type="button"
              onClick={onOpenStudio}
              className="cursor-pointer font-semibold text-accent underline-offset-2 hover:underline"
            >
              Studio
            </button>{' '}
            and keep the best ones with “Use as character reference”.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-stack xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start">
        <CharacterForm character={character} onSaved={setCharacter} delay={40} />
        <CharacterRefs character={character} maxReferences={maxReferences} onChanged={setCharacter} delay={80} />
      </div>
    </div>
  )
}

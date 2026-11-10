import { useEffect, useState, type FormEvent } from 'react'
import { CircleAlert, CircleCheck, UserRound } from 'lucide-react'
import { BTN_PRIMARY, FIELD, HINT, INPUT, LABEL } from '../../../settings/formClasses'
import { fmtDateTime } from '../../../../lib/format'
import { creativeErrorMessage } from '../../../../lib/creatives'
import { updateCreativeCharacter } from '../../../../services/creatives'
import type { CreativeCharacter, CreativeCharacterInput } from '../../../../types/creatives'
import SectionHeader from '../SectionHeader'
import { NOTICE, SECTION, TEXTAREA } from '../creativeClasses'

interface CharacterFormProps {
  character: CreativeCharacter
  onSaved: (character: CreativeCharacter) => void
  delay?: number
}

const TEXT_MAX = 2000

function inputFrom(c: CreativeCharacter): CreativeCharacterInput {
  return { name: c.name, look: c.look, style_prompt: c.style_prompt, rules: c.rules }
}

/** Blank text goes as null, so clearing a box clears it on the server. */
function clean(f: CreativeCharacterInput): CreativeCharacterInput {
  const opt = (v: string | null) => (v === null || v.trim() === '' ? null : v.trim())
  return { name: f.name.trim(), look: opt(f.look), style_prompt: opt(f.style_prompt), rules: opt(f.rules) }
}

/** The lines added under every prompt that uses the character — the API's own assembly, previewed. */
function promptTail(f: CreativeCharacterInput): string {
  const c = clean(f)
  const lines = [
    c.look ? `Character "${c.name}": ${c.look}` : null,
    c.style_prompt ? `Style: ${c.style_prompt}` : null,
    c.rules ? `Rules: ${c.rules}` : null,
  ]
    .filter(Boolean)
    .join('\n')
  return lines || '(nothing — all three boxes are empty)'
}

/**
 * Who the character is, in words: its name, how it looks, the art style and
 * the rules it never breaks. These lines are added under every prompt that
 * uses the character, so editing them changes everything made from now on.
 */
export default function CharacterForm({ character, onSaved, delay }: CharacterFormProps) {
  const [form, setForm] = useState<CreativeCharacterInput>(() => inputFrom(character))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // A save elsewhere (or a reload) replaces the record — reseed from it.
  useEffect(() => {
    setForm(inputFrom(character))
  }, [character.id, character.updated_at]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key: keyof CreativeCharacterInput, value: string) => {
    setSaved(false)
    setForm((f) => ({ ...f, [key]: value }))
  }

  const dirty = JSON.stringify(clean(form)) !== JSON.stringify(clean(inputFrom(character)))
  const nameLength = form.name.trim().length

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (nameLength < 2 || nameLength > 80) {
      setError('The name needs 2 to 80 characters.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const next = await updateCreativeCharacter(clean(form))
      onSaved(next)
      setSaved(true)
    } catch (err) {
      setError(creativeErrorMessage(err, 'Could not save the character.'))
    } finally {
      setSaving(false)
    }
  }

  const area = (key: 'look' | 'style_prompt' | 'rules', label: string, placeholder: string, hint: string) => (
    <label className={FIELD}>
      <span className={LABEL}>{label}</span>
      <textarea
        className={TEXTAREA}
        rows={3}
        maxLength={TEXT_MAX}
        value={form[key] ?? ''}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
        disabled={saving}
      />
      <span className={HINT}>{hint}</span>
    </label>
  )

  return (
    <section className={SECTION} data-aos="fade-up" data-aos-delay={delay} aria-labelledby="creatives-character">
      <SectionHeader
        icon={UserRound}
        id="creatives-character"
        title={`${character.name}, in words`}
        subtitle={
          character.updated_at
            ? `Last saved ${fmtDateTime(character.updated_at)}${character.updated_by_name ? ` by ${character.updated_by_name}` : ''}.`
            : 'Added under every prompt that uses the character.'
        }
      />

      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <label className={FIELD}>
          <span className={LABEL}>Name</span>
          <input
            className={INPUT}
            value={form.name}
            maxLength={80}
            onChange={(e) => set('name', e.target.value)}
            disabled={saving}
            required
          />
        </label>
        {area('look', 'Look', 'What it looks like: shape, colours, clothes, badge…', 'Describe it the same way every time — this is what keeps it recognisable.')}
        {area('style_prompt', 'Style', 'e.g. 16-bit pixel art, crisp hard-edged pixels, limited palette…', 'The art style every picture and video is made in.')}
        {area('rules', 'Rules', 'e.g. Never show real people or any money amounts.', 'What it must never do or show.')}

        <details className="group rounded-row border border-hair bg-surface2 px-3.5 py-3">
          <summary className="cursor-pointer text-[12.5px] font-semibold text-muted marker:text-faint group-open:mb-2.5">
            See what is added under every prompt
          </summary>
          <pre className="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-[1.6] text-text">
            {'{your prompt}\n\n'}
            {promptTail(form)}
          </pre>
        </details>

        {error && (
          <p className={NOTICE.error} role="alert">
            <CircleAlert size={15} aria-hidden="true" />
            {error}
          </p>
        )}
        {saved && !dirty && (
          <p className={NOTICE.success} role="status">
            <CircleCheck size={15} aria-hidden="true" />
            Saved. Everything generated from now on uses these words.
          </p>
        )}

        <div className="flex justify-end border-t border-hair pt-4">
          <button type="submit" className={`${BTN_PRIMARY} max-sm:w-full`} disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save character'}
          </button>
        </div>
      </form>
    </section>
  )
}

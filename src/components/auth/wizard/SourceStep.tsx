import { Link } from 'react-router-dom'
import HeardAboutGrid from '../HeardAboutGrid'
import { CHECKBOX, CHECKBOX_LABEL, LINK } from '../authClasses'
import type { SignupSource } from '../../../lib/signupSources'

interface Props {
  heardFrom: SignupSource[]
  onHeardFrom: (v: SignupSource[]) => void
  heardOther: string
  onHeardOther: (v: string) => void
  terms: boolean
  onTerms: (v: boolean) => void
}

/**
 * The last step — "How did you hear about us?" (optional) and the Terms
 * (required), right above the button that creates the account.
 */
export default function SourceStep({
  heardFrom,
  onHeardFrom,
  heardOther,
  onHeardOther,
  terms,
  onTerms,
}: Props) {
  return (
    <>
      <HeardAboutGrid
        value={heardFrom}
        onChange={onHeardFrom}
        other={heardOther}
        onOtherChange={onHeardOther}
        hideLegend
      />
      <label className={`${CHECKBOX_LABEL} mt-1.5 border-t border-border pt-4`}>
        <input
          type="checkbox"
          className={CHECKBOX}
          checked={terms}
          onChange={(e) => onTerms(e.target.checked)}
          required
        />
        <span>
          I have read and agree to the{' '}
          <Link to="/terms" target="_blank" className={LINK}>
            Terms
          </Link>
          ,{' '}
          <Link to="/privacy" target="_blank" className={LINK}>
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link to="/risk" target="_blank" className={LINK}>
            Risk Disclosure
          </Link>
          , and I understand that leveraged trading can lose my capital.
        </span>
      </label>
    </>
  )
}

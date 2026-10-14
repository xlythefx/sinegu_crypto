import HandleInput from '../HandleInput'

interface Props {
  telegram: string
  onTelegram: (v: string) => void
  /** Omit both on the Discord sign-up — its Discord is the linked account. */
  discord?: string
  onDiscord?: (v: string) => void
}

/** Step 3 — the optional Telegram / Discord usernames, one per row. */
export default function SocialsStep({ telegram, onTelegram, discord, onDiscord }: Props) {
  return (
    <>
      <HandleInput platform="telegram" value={telegram} onChange={onTelegram} />
      {discord !== undefined && onDiscord && (
        <HandleInput platform="discord" value={discord} onChange={onDiscord} />
      )}
      <p className="m-0 text-[12.5px] leading-[1.55] text-faint">
        Type your username with or without the @. Nothing to add? Skip this step — you can add
        {discord !== undefined ? ' them' : ' it'} later in Settings.
      </p>
    </>
  )
}

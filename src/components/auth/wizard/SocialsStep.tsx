import HandleInput from '../HandleInput'
import WhatsAppInput from '../WhatsAppInput'

interface Props {
  telegram: string
  onTelegram: (v: string) => void
  whatsapp: string
  onWhatsapp: (v: string) => void
  /** Omit both on the Discord sign-up — its Discord is the linked account. */
  discord?: string
  onDiscord?: (v: string) => void
}

/**
 * Step 3 — how the team reaches you: Telegram and WhatsApp are required
 * (owner, 2026-11-16), Discord optional and only asked on the password
 * sign-up.
 */
export default function SocialsStep({ telegram, onTelegram, whatsapp, onWhatsapp, discord, onDiscord }: Props) {
  return (
    <>
      <HandleInput platform="telegram" value={telegram} onChange={onTelegram} required />
      <WhatsAppInput value={whatsapp} onChange={onWhatsapp} />
      {discord !== undefined && onDiscord && (
        <HandleInput platform="discord" value={discord} onChange={onDiscord} />
      )}
      <p className="m-0 text-[12.5px] leading-[1.55] text-faint">
        Type your Telegram username with or without the @, and pick your country for WhatsApp.
        {discord !== undefined ? ' Discord is optional.' : ''} You can change them later in Settings.
      </p>
    </>
  )
}

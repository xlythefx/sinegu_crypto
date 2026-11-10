import { TikTokMark, XMark } from '../../ui/BrandIcons'
import { FORMAT_LABEL, PLATFORM_LABEL } from '../../../lib/creatives'
import type { CreativeFormat, CreativePlatform } from '../../../types/creatives'
import { PILL_BASE, TONE_PILL } from './creativeClasses'
import { FORMAT_ICON } from './creativeIcons'
import TonePill from './TonePill'

/** X or TikTok, with the brand's own mark. */
export function PlatformPill({ platform }: { platform: CreativePlatform }) {
  const Mark = platform === 'tiktok' ? TikTokMark : XMark
  return (
    <span className={`${PILL_BASE} ${TONE_PILL[platform === 'tiktok' ? 'teal' : 'muted']}`}>
      <Mark size={10} />
      {PLATFORM_LABEL[platform]}
    </span>
  )
}

/** Video / Image / Carousel. */
export function FormatPill({ format }: { format: CreativeFormat }) {
  return (
    <TonePill tone="muted" icon={FORMAT_ICON[format]}>
      {FORMAT_LABEL[format]}
    </TonePill>
  )
}

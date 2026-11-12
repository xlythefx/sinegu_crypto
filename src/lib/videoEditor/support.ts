/**
 * Can THIS browser export an MP4? Export runs in the browser (the server is
 * busy trading), with WebCodecs: an H.264 video encoder at the export size
 * and — natively or through the small AAC add-on — an AAC audio encoder.
 * Chrome, Edge and Safari 26+ pass; Firefox's H.264 encoding is not reliable
 * enough, so it gets the gate rather than a broken file.
 */

export interface ExportSupport {
  ok: boolean
  /** Why not, in one plain sentence (null when ok). */
  reason: string | null
  /** No native AAC encoder: load the add-on before encoding. */
  needsAacWasm: boolean
  /** The H.264 codec string that passed (null when none did). */
  codec: string | null
}

export const BROWSER_GATE = 'Export works in Chrome, Edge or Safari 26+. Open this page in one of those to download the MP4.'

/** High profile first (sharper), then Main, then Baseline — the first one the encoder accepts wins. */
export const AVC_CODECS = ['avc1.640028', 'avc1.4d0028', 'avc1.42e028'] as const

export interface SupportEnv {
  VideoEncoder?: { isConfigSupported(config: VideoEncoderConfig): Promise<VideoEncoderSupport> }
  AudioEncoder?: unknown
  OffscreenCanvas?: unknown
  Worker?: unknown
  userAgent?: string
  /** mediabunny's `canEncodeAudio('aac')`, injected so this module stays light. */
  canEncodeAac?: () => Promise<boolean>
}

/** The real browser globals; add `canEncodeAac` from mediabunny when it is loaded. */
export function browserEnv(): SupportEnv {
  const g = globalThis as unknown as Record<string, unknown>
  return {
    VideoEncoder: g.VideoEncoder as SupportEnv['VideoEncoder'],
    AudioEncoder: g.AudioEncoder,
    OffscreenCanvas: g.OffscreenCanvas,
    Worker: g.Worker,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  }
}

export function isFirefox(userAgent: string | undefined): boolean {
  return !!userAgent && /firefox|fxios/i.test(userAgent)
}

/**
 * The verdict for an export at `width × height`, 30 fps. Pass `env` in tests;
 * the browser's own globals are used otherwise.
 */
export async function exportSupport(width: number, height: number, env: SupportEnv = browserEnv()): Promise<ExportSupport> {
  const no = (reason: string): ExportSupport => ({ ok: false, reason, needsAacWasm: false, codec: null })
  if (isFirefox(env.userAgent)) return no(BROWSER_GATE)
  if (!env.VideoEncoder || !env.OffscreenCanvas || !env.Worker) return no(BROWSER_GATE)

  let codec: string | null = null
  for (const candidate of AVC_CODECS) {
    try {
      const res = await env.VideoEncoder.isConfigSupported({
        codec: candidate,
        width,
        height,
        bitrate: 8_000_000,
        framerate: 30,
      })
      if (res.supported) {
        codec = candidate
        break
      }
    } catch {
      // A codec string this browser does not parse is simply not supported.
    }
  }
  if (!codec) return no(`This browser cannot encode H.264 video at ${width}×${height}. ${BROWSER_GATE}`)

  let nativeAac = false
  try {
    nativeAac = env.canEncodeAac ? await env.canEncodeAac() : false
  } catch {
    nativeAac = false
  }
  return { ok: true, reason: null, needsAacWasm: !nativeAac, codec }
}

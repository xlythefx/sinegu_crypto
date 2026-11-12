import { describe, expect, it } from 'vitest'
import { AVC_CODECS, BROWSER_GATE, exportSupport, type SupportEnv } from './support'

const encoder = (supported: (codec: string) => boolean): SupportEnv['VideoEncoder'] => ({
  isConfigSupported: async (config: VideoEncoderConfig) => ({ supported: supported(config.codec), config }),
})

const chrome: SupportEnv = {
  VideoEncoder: encoder(() => true),
  AudioEncoder: {},
  OffscreenCanvas: {},
  Worker: {},
  userAgent: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/140.0 Safari/537.36',
  canEncodeAac: async () => true,
}

describe('exportSupport', () => {
  it('passes Chrome with native AAC on the first (High) profile', async () => {
    expect(await exportSupport(1080, 1920, chrome)).toEqual({ ok: true, reason: null, needsAacWasm: false, codec: AVC_CODECS[0] })
  })

  it('falls back to a lower H.264 profile', async () => {
    const env = { ...chrome, VideoEncoder: encoder((c) => c === 'avc1.42e028') }
    expect((await exportSupport(1080, 1920, env)).codec).toBe('avc1.42e028')
  })

  it('asks for the AAC add-on when the browser has no AAC encoder', async () => {
    const res = await exportSupport(1080, 1080, { ...chrome, canEncodeAac: async () => false })
    expect(res).toMatchObject({ ok: true, needsAacWasm: true })
  })

  it('gates Firefox even when it has WebCodecs', async () => {
    const res = await exportSupport(1080, 1920, {
      ...chrome,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; rv:140.0) Gecko/20100101 Firefox/140.0',
    })
    expect(res).toMatchObject({ ok: false, reason: BROWSER_GATE })
  })

  it('gates a browser without WebCodecs (old Safari)', async () => {
    const res = await exportSupport(1080, 1920, { ...chrome, VideoEncoder: undefined })
    expect(res).toMatchObject({ ok: false, reason: BROWSER_GATE })
  })

  it('says so when no H.264 profile is accepted at that size', async () => {
    const res = await exportSupport(1920, 1080, { ...chrome, VideoEncoder: encoder(() => false) })
    expect(res.ok).toBe(false)
    expect(res.reason).toContain('1920×1080')
  })

  it('treats a codec string the encoder throws on as unsupported', async () => {
    const env: SupportEnv = {
      ...chrome,
      VideoEncoder: {
        isConfigSupported: async (c: VideoEncoderConfig) => {
          if (c.codec !== 'avc1.4d0028') throw new TypeError('bad codec')
          return { supported: true, config: c }
        },
      },
    }
    expect((await exportSupport(1080, 1920, env)).codec).toBe('avc1.4d0028')
  })
})

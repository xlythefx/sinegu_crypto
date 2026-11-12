/**
 * The messages between the page and the export worker
 * (workers/videoExport.worker.ts). Everything here is structured-clonable:
 * clip files go as Blobs, the mixed soundtrack as planar Float32 channels
 * (transferred, not copied), the finished MP4 back as an ArrayBuffer.
 */

import type { CaptionStyle, TemplateFields, TimelineCaption, TimelineLook } from '../../types/creativeVideos'

export interface ExportScene {
  kind: 'clip' | 'template'
  /** On the video's clock. */
  start_ms: number
  end_ms: number
  /** Inside the clip. */
  in_ms: number
  out_ms: number
  /** clip: the MP4. */
  blob?: Blob
  /** template: what the card prints. */
  template?: TemplateFields
}

export interface ExportJob {
  width: number
  height: number
  fps: number
  /** The H.264 codec string the support check accepted. */
  codec: string
  videoBitrate: number
  totalMs: number
  scenes: ExportScene[]
  captions: TimelineCaption[]
  captionStyle: CaptionStyle
  look: TimelineLook
  /** null = a silent video. */
  audio: { sampleRate: number; channels: Float32Array[] } | null
  audioBitrate: number
}

export type ExportWorkerMessage =
  | { type: 'progress'; frame: number; frames: number }
  | { type: 'done'; buffer: ArrayBuffer; mime: string }
  | { type: 'error'; message: string }

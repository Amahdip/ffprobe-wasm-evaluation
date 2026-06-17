import type { FileInfo } from './types'

export type MediaStream = FileInfo['streams'][number]

export function getVideoStreams(streams: FileInfo['streams']): MediaStream[] {
  return streams.filter((stream) => stream.codec_type === 'video')
}

export function getAudioStreams(streams: FileInfo['streams']): MediaStream[] {
  return streams.filter((stream) => stream.codec_type === 'audio')
}

export function getPrimaryVideoStream(streams: FileInfo['streams']): MediaStream | undefined {
  return getVideoStreams(streams)[0]
}

export function getPrimaryAudioStream(streams: FileInfo['streams']): MediaStream | undefined {
  return getAudioStreams(streams)[0]
}

export function readStreamDimension(
  stream: MediaStream | undefined,
  axis: 'width' | 'height',
): number | null {
  return readStreamDimensionWithSource(stream, axis).value
}

export function readStreamDimensionWithSource(
  stream: MediaStream | undefined,
  axis: 'width' | 'height',
): { value: number | null; source: string | null } {
  if (!stream) {
    return { value: null, source: null }
  }

  const direct = stream[axis]
  const codedKey = axis === 'width' ? 'codec_width' : 'codec_height'
  const coded = stream[codedKey]

  if (typeof direct === 'number' && direct > 0) {
    return { value: direct, source: `streams[${stream.index}].${axis}` }
  }

  if (typeof coded === 'number' && coded > 0) {
    return {
      value: coded,
      source: `streams[${stream.index}].codec_width/codec_height fallback`,
    }
  }

  return { value: null, source: null }
}

import type { FileInfo } from 'ffprobe-wasm'
import type { NormalizedMetadata, UploaderPolicy, ValidationIssue } from '../../types'
import { createIssue, normalizeCodec, parseStreamNumber } from '../helpers'

export function runAudioChecks(
  fileInfo: FileInfo,
  metadata: NormalizedMetadata,
  policy: UploaderPolicy,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const primaryAudio = fileInfo.streams.find((s) => s.index === metadata.primaryAudioStreamIndex)

  if (!metadata.hasAudio) {
    issues.push(createIssue('no_audio_stream', 'No audio stream detected.', 'warning'))
    return issues
  }

  if (metadata.audioStreamCount > 1) {
    issues.push(
      createIssue(
        'multiple_audio_tracks',
        `Multiple audio tracks detected (${metadata.audioStreamCount}).`,
        'warning',
      ),
    )
  }

  const audioCodec = normalizeCodec(metadata.audioCodec)
  if (!policy.allowedAudioCodecs.some((codec) => audioCodec.includes(codec))) {
    issues.push(
      createIssue(
        'audio_codec_unsupported',
        `Audio codec "${metadata.audioCodec}" is outside the allowed list (${policy.allowedAudioCodecs.join(', ')}).`,
        'warning',
      ),
    )
  }

  if (policy.warnAudioCodecs.some((codec) => audioCodec.includes(codec))) {
    issues.push(
      createIssue(
        'audio_codec_review',
        `Audio codec "${metadata.audioCodec}" is flagged for extra review.`,
        'warning',
      ),
    )
  }

  const audioBitrate = metadata.audioBitrateBps ?? parseStreamNumber(primaryAudio?.bit_rate)
  if (audioBitrate !== null) {
    if (audioBitrate < policy.minAudioBitrateBps) {
      issues.push(
        createIssue(
          'audio_bitrate_too_low',
          `Audio bitrate (${Math.round(audioBitrate / 1000)} kbps) is below minimum (${Math.round(policy.minAudioBitrateBps / 1000)} kbps).`,
          'warning',
        ),
      )
    }
    if (audioBitrate > policy.maxAudioBitrateBps) {
      issues.push(
        createIssue(
          'audio_bitrate_too_high',
          `Audio bitrate (${Math.round(audioBitrate / 1000)} kbps) exceeds maximum (${Math.round(policy.maxAudioBitrateBps / 1000)} kbps).`,
          'warning',
        ),
      )
    }
  }

  const sampleRate = metadata.audioSampleRate
  if (sampleRate !== null && !policy.standardAudioSampleRates.includes(sampleRate)) {
    issues.push(
      createIssue(
        'audio_sample_rate_unusual',
        `Audio sample rate ${sampleRate} Hz is unusual (expected ${policy.standardAudioSampleRates.join(' or ')} Hz).`,
        'warning',
      ),
    )
  }

  const channels = metadata.audioChannels
  if (channels !== null) {
    if (channels === 0) {
      issues.push(createIssue('audio_channels_zero', 'Audio channel count is 0.', 'warning'))
    } else if (channels === 1 && policy.warnMonoAudio) {
      issues.push(createIssue('audio_channels_mono', 'Mono audio detected (1 channel).', 'warning'))
    } else if (channels >= 6 && policy.warnSurroundAudio) {
      issues.push(
        createIssue(
          'audio_channels_surround',
          `Unusual multichannel audio detected (${channels} channels).`,
          'warning',
        ),
      )
    }
  }

  if (
    metadata.hasVideo &&
    metadata.videoStreamDurationSeconds !== null &&
    metadata.audioStreamDurationSeconds !== null &&
    Math.abs(metadata.videoStreamDurationSeconds - metadata.audioStreamDurationSeconds) >
      policy.maxAudioVideoDurationDeltaSeconds
  ) {
    issues.push(
      createIssue(
        'av_duration_mismatch',
        `Primary video duration (${metadata.videoStreamDurationSeconds.toFixed(3)}s) differs from primary audio duration (${metadata.audioStreamDurationSeconds.toFixed(3)}s) by more than ${policy.maxAudioVideoDurationDeltaSeconds}s.`,
        'warning',
      ),
    )
  }

  return issues
}

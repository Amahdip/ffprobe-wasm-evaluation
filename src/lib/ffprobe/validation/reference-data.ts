import { DEFAULT_UPLOADER_POLICY, type UploaderPolicy, type ValidationDecision } from '../types'

export type IssueSeverity = 'error' | 'warning' | 'info'

export interface ValidationCheckReference {
  code: string
  severity: IssueSeverity
  condition: string
  userImpact: string
}

export interface ValidationCheckGroupReference {
  id: string
  label: string
  description: string
  checks: ValidationCheckReference[]
}

export interface DecisionOutcomeReference {
  decision: ValidationDecision
  label: string
  badgeClass: string
  meaning: string
  uploadAction: string
}

export const DECISION_OUTCOMES: DecisionOutcomeReference[] = [
  {
    decision: 'pass',
    label: 'PASS',
    badgeClass: 'badge-success',
    meaning: 'No warnings or errors detected.',
    uploadAction: 'Proceed — browser preflight is clean.',
  },
  {
    decision: 'warn',
    label: 'WARNING',
    badgeClass: 'badge-warning',
    meaning: 'Non-blocking issues only (warnings or info).',
    uploadAction: 'Proceed with caution — review warnings; backend remains authoritative.',
  },
  {
    decision: 'soft_fail',
    label: 'SOFT FAIL',
    badgeClass: 'badge-warning',
    meaning: 'Analysis failed or non-blocking errors detected.',
    uploadAction: 'Do not block upload solely for this — rely on backend/Akuma validation.',
  },
  {
    decision: 'block',
    label: 'BLOCKED',
    badgeClass: 'badge-error',
    meaning: 'Hard policy violation (configured block codes).',
    uploadAction: 'Show strong warning — backend still makes the final decision.',
  },
]

export const SEVERITY_LEGEND: { severity: IssueSeverity; badgeClass: string; label: string; description: string }[] = [
  {
    severity: 'error',
    badgeClass: 'badge-error',
    label: 'Error',
    description: 'Policy violation. May lead to soft_fail or block depending on the code.',
  },
  {
    severity: 'warning',
    badgeClass: 'badge-warning',
    label: 'Warning',
    description: 'Risk or mismatch that needs attention but does not alone block upload.',
  },
  {
    severity: 'info',
    badgeClass: 'badge-info',
    label: 'Info',
    description: 'Informational note (e.g. vertical video, size category).',
  },
]

export const VALIDATION_CHECK_GROUPS: ValidationCheckGroupReference[] = [
  {
    id: 'container',
    label: 'Container / file',
    description: 'Format detection, extension/MIME match, encryption, probe quality.',
    checks: [
      { code: 'analyze_failed', severity: 'error', condition: 'Browser ffprobe could not read the file.', userImpact: 'soft_fail — do not block upload for this alone.' },
      { code: 'file_corrupted_or_unreadable', severity: 'warning', condition: 'Emitted alongside analyze_failed.', userImpact: 'Informational corruption hint.' },
      { code: 'unsupported_container', severity: 'warning', condition: 'Container outside allowed list.', userImpact: 'Review format before upload.' },
      { code: 'extension_container_mismatch', severity: 'warning', condition: 'File extension does not match detected container.', userImpact: 'Possible wrong extension.' },
      { code: 'wrong_extension_valid_video', severity: 'info', condition: 'Extension mismatch but valid streams found.', userImpact: 'Likely rename-only issue.' },
      { code: 'mime_container_mismatch', severity: 'warning', condition: 'Browser MIME type differs from container.', userImpact: 'Browser vs file mismatch.' },
      { code: 'media_encrypted_or_protected', severity: 'warning', condition: 'Encryption/protection metadata in tags.', userImpact: 'May fail downstream processing.' },
      { code: 'fragmented_mp4', severity: 'warning', condition: 'Fragmented MP4 / non-faststart hints.', userImpact: 'Moov placement not verified client-side.' },
      { code: 'low_probe_score', severity: 'warning', condition: 'Container probe_score < 50.', userImpact: 'Unusual or partial file structure.' },
    ],
  },
  {
    id: 'audio',
    label: 'Audio',
    description: 'Audio presence, codec, bitrate, channels, A/V duration sync.',
    checks: [
      { code: 'no_audio_stream', severity: 'warning', condition: 'No audio stream detected.', userImpact: 'Video-only upload.' },
      { code: 'multiple_audio_tracks', severity: 'warning', condition: 'More than one audio track.', userImpact: 'Multi-track file.' },
      { code: 'audio_codec_unsupported', severity: 'warning', condition: 'Codec outside allowed list.', userImpact: 'Transcode may be required.' },
      { code: 'audio_codec_review', severity: 'warning', condition: 'Codec flagged for extra review.', userImpact: 'Manual review suggested.' },
      { code: 'audio_bitrate_too_low', severity: 'warning', condition: 'Below minimum audio bitrate.', userImpact: 'Quality concern.' },
      { code: 'audio_bitrate_too_high', severity: 'warning', condition: 'Above maximum audio bitrate.', userImpact: 'Efficiency concern.' },
      { code: 'audio_sample_rate_unusual', severity: 'warning', condition: 'Not 44100 or 48000 Hz.', userImpact: 'Non-standard sample rate.' },
      { code: 'audio_channels_zero', severity: 'warning', condition: 'Channel count is 0.', userImpact: 'Invalid audio metadata.' },
      { code: 'audio_channels_mono', severity: 'warning', condition: 'Mono audio (1 channel).', userImpact: 'Policy flags mono for review.' },
      { code: 'audio_channels_surround', severity: 'warning', condition: '6+ channels (surround).', userImpact: 'Unusual for upload.' },
      { code: 'av_duration_mismatch', severity: 'warning', condition: 'Video vs audio duration delta > policy limit.', userImpact: 'Sync or edit issue.' },
    ],
  },
  {
    id: 'video',
    label: 'Video stream',
    description: 'Codec, pixel format, HDR, interlacing, stream count.',
    checks: [
      { code: 'no_video_stream', severity: 'warning', condition: 'No video stream detected.', userImpact: 'Audio-only upload.' },
      { code: 'multiple_video_streams', severity: 'warning', condition: 'More than one video stream.', userImpact: 'Multi-video file.' },
      { code: 'video_codec_unsupported', severity: 'warning', condition: 'Codec outside allowed list.', userImpact: 'Transcode may be required.' },
      { code: 'codec_av1', severity: 'warning', condition: 'AV1 detected.', userImpact: 'Compatibility varies.' },
      { code: 'codec_hevc', severity: 'warning', condition: 'HEVC/H.265 detected.', userImpact: 'Playback/transcode varies.' },
      { code: 'codec_vp8_vp9', severity: 'warning', condition: 'VP8/VP9 when policy prefers others.', userImpact: 'Review codec choice.' },
      { code: 'video_codec_review', severity: 'warning', condition: 'Codec flagged for extra review.', userImpact: 'Manual review suggested.' },
      { code: 'pixel_format_unusual', severity: 'warning', condition: 'Not yuv420p / yuvj420p.', userImpact: 'Encoder compatibility risk.' },
      { code: 'video_10bit', severity: 'warning', condition: '10-bit pixel format.', userImpact: 'Transcode compatibility varies.' },
      { code: 'video_hdr_metadata', severity: 'warning', condition: 'HDR color metadata present.', userImpact: 'HDR pipeline required.' },
      { code: 'video_interlaced', severity: 'warning', condition: 'Interlaced field order detected.', userImpact: 'Deinterlace may be needed.' },
    ],
  },
  {
    id: 'resolution',
    label: 'Resolution / dimensions',
    description: 'Width/height, aspect ratio, divisibility, vertical video.',
    checks: [
      { code: 'dimensions_unreliable', severity: 'warning', condition: 'Dimensions unavailable (ffprobe limitation).', userImpact: 'Use backend for resolution validation.' },
      { code: 'dimensions_missing', severity: 'warning', condition: 'Width/height could not be determined.', userImpact: 'Missing resolution metadata.' },
      { code: 'dimensions_codec_fallback', severity: 'warning', condition: 'Recovered from codec_width/codec_height.', userImpact: 'Native width/height missing.' },
      { code: 'resolution_too_small', severity: 'warning', condition: 'Below minimum width/height.', userImpact: 'Below policy floor.' },
      { code: 'resolution_too_large', severity: 'warning', condition: 'Above maximum width/height.', userImpact: 'Above policy ceiling.' },
      { code: 'vertical_video', severity: 'info', condition: 'Height > width.', userImpact: 'Vertical orientation note.' },
      { code: 'aspect_ratio_non_standard', severity: 'warning', condition: 'Non-standard aspect ratio.', userImpact: 'Letterboxing/crop risk.' },
      { code: 'dimensions_not_divisible_by_2', severity: 'warning', condition: 'Width or height odd.', userImpact: 'Encoding compatibility risk.' },
      { code: 'dimensions_not_divisible_by_16', severity: 'warning', condition: 'Not divisible by 16.', userImpact: 'Encoder efficiency impact.' },
    ],
  },
  {
    id: 'fps',
    label: 'FPS',
    description: 'Frame rate validity and variable frame rate suspicion.',
    checks: [
      { code: 'fps_missing', severity: 'warning', condition: 'FPS missing or 0/0.', userImpact: 'Unknown frame rate.' },
      { code: 'fps_invalid', severity: 'warning', condition: 'Non-finite or non-positive FPS.', userImpact: 'Invalid frame rate metadata.' },
      { code: 'fps_too_low', severity: 'warning', condition: 'Below minimum FPS.', userImpact: 'Below policy floor.' },
      { code: 'fps_too_high', severity: 'warning', condition: 'Above maximum FPS.', userImpact: 'Above policy ceiling.' },
      { code: 'vfr_suspected', severity: 'warning', condition: 'Avg vs raw FPS diverge beyond threshold.', userImpact: 'Variable frame rate suspected.' },
    ],
  },
  {
    id: 'duration',
    label: 'Duration',
    description: 'File length and container vs stream duration consistency.',
    checks: [
      { code: 'duration_missing', severity: 'warning', condition: 'Duration not available.', userImpact: 'Unknown length.' },
      { code: 'duration_too_short', severity: 'warning', condition: 'Below minimum duration.', userImpact: 'Very short clip.' },
      { code: 'duration_exceeds_max', severity: 'error', condition: 'Above configured maximum duration.', userImpact: 'block if code is in blockViolationCodes.' },
      { code: 'container_stream_duration_mismatch', severity: 'warning', condition: 'Container vs video stream duration differ.', userImpact: 'Metadata inconsistency.' },
    ],
  },
  {
    id: 'bitrate',
    label: 'Bitrate / size',
    description: 'File size, bitrate limits, and size category.',
    checks: [
      { code: 'file_too_large', severity: 'error', condition: 'File size above maximum.', userImpact: 'block if code is in blockViolationCodes.' },
      { code: 'upload_size_category', severity: 'info', condition: 'Estimated size bucket (small/medium/large).', userImpact: 'Informational only.' },
      { code: 'bitrate_missing', severity: 'warning', condition: 'Bitrate not available.', userImpact: 'Unknown bitrate.' },
      { code: 'bitrate_too_high', severity: 'warning', condition: 'Above configured max bitrate.', userImpact: 'High bandwidth file.' },
      { code: 'bitrate_suspiciously_low', severity: 'warning', condition: 'Bitrate low for resolution (kbps/Mpix).', userImpact: 'Quality concern.' },
    ],
  },
]

export interface PolicyLimitRow {
  label: string
  value: string
  notes?: string
}

export function buildPolicyLimitRows(policy: UploaderPolicy = DEFAULT_UPLOADER_POLICY): PolicyLimitRow[] {
  return [
    { label: 'Max duration', value: `${policy.maxDurationSeconds}s`, notes: 'Default 1 hour' },
    { label: 'Min duration', value: `${policy.minDurationSeconds}s` },
    { label: 'Max file size', value: `${Math.round(policy.maxFileSizeBytes / (1024 * 1024 * 1024))} GB` },
    { label: 'Max bitrate', value: `${Math.round(policy.maxBitrateBps / 1_000_000)} Mbps` },
    { label: 'FPS range', value: `${policy.minFps} – ${policy.maxFps}` },
    {
      label: 'Resolution range',
      value: `${policy.minWidth}×${policy.minHeight} – ${policy.maxWidth}×${policy.maxHeight}`,
    },
    { label: 'Allowed containers', value: policy.allowedContainers.join(', ') },
    { label: 'Allowed video codecs', value: policy.allowedVideoCodecs.join(', ') },
    { label: 'Allowed audio codecs', value: policy.allowedAudioCodecs.join(', ') },
    { label: 'A/V duration delta max', value: `${policy.maxAudioVideoDurationDeltaSeconds}s` },
    {
      label: 'Block violation codes',
      value: policy.blockViolationCodes.join(', '),
      notes: 'Only these error codes produce a block decision',
    },
  ]
}

import type { FileInfo } from 'ffprobe-wasm'
import type { NormalizedMetadata, UploaderPolicy, ValidationIssue } from '../../types'
import { containerAllowed, createIssue } from '../helpers'

export function runContainerChecks(
  fileInfo: FileInfo,
  metadata: NormalizedMetadata,
  policy: UploaderPolicy,
  analyzeError: string | null,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (analyzeError) {
    issues.push(
      createIssue(
        'analyze_failed',
        `ffprobe-wasm could not analyze this file: ${analyzeError}. Treat as best-effort only; do not block upload solely for this.`,
        'error',
      ),
    )
    issues.push(
      createIssue(
        'file_corrupted_or_unreadable',
        'File appears corrupted or unreadable by client-side ffprobe-wasm.',
        'warning',
      ),
    )
    return issues
  }

  if (metadata.containerFormat && !containerAllowed(metadata.containerFormat, policy.allowedContainers)) {
    issues.push(
      createIssue(
        'unsupported_container',
        `Container "${metadata.containerFormat}" is outside allowed list (${policy.allowedContainers.join(', ')}).`,
        'warning',
      ),
    )
  }

  if (metadata.extensionContainerMatch === false) {
    issues.push(
      createIssue(
        'extension_container_mismatch',
        `File extension ".${metadata.fileExtension}" does not match detected container "${metadata.containerFormat}".`,
        'warning',
      ),
    )

    if (metadata.hasVideo || metadata.hasAudio) {
      issues.push(
        createIssue(
          'wrong_extension_valid_video',
          'Extension mismatch, but valid video/audio streams were detected.',
          'info',
        ),
      )
    }
  }

  if (metadata.mimeContainerMatch === false) {
    issues.push(
      createIssue(
        'mime_container_mismatch',
        `Browser MIME type "${metadata.mimeType}" does not match detected container "${metadata.containerFormat}".`,
        'warning',
      ),
    )
  }

  const formatTags = fileInfo.format?.tags ?? {}
  const encryptionHint =
    formatTags.encryption ??
    formatTags.ENCRYPTION ??
    formatTags.protected ??
    formatTags.PROTECTED

  if (encryptionHint) {
    issues.push(
      createIssue(
        'media_encrypted_or_protected',
        'Encrypted or protected media metadata detected.',
        'warning',
      ),
    )
  }

  const fragmentedHint =
    formatTags.major_brand === 'iso5' ||
    formatTags.compatible_brands?.includes('iso5') ||
    formatTags.movflags?.includes('frag')

  if (fragmentedHint && metadata.containerFormat?.includes('mp4')) {
    issues.push(
      createIssue(
        'fragmented_mp4',
        'Fragmented MP4 or non-faststart layout may be present (moov atom placement not fully verified client-side).',
        'warning',
      ),
    )
  }

  const probeScore = Number.parseFloat(String(fileInfo.format?.probe_score ?? ''))
  if (Number.isFinite(probeScore) && probeScore < 50) {
    issues.push(
      createIssue(
        'low_probe_score',
        `Low container probe score (${probeScore}). File structure may be unusual or partially readable.`,
        'warning',
      ),
    )
  }

  return issues
}

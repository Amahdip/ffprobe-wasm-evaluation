import type { FileInfo } from 'ffprobe-wasm'
import type { DimensionDiagnostics, NormalizedMetadata, UploaderPolicy, ValidationCheckGroup, ValidationIssue } from '../types'
import { runAudioChecks } from './checks/audio-checks'
import { runBitrateSizeChecks } from './checks/bitrate-size-checks'
import { runContainerChecks } from './checks/container-checks'
import { runDurationChecks } from './checks/duration-checks'
import { runFpsChecks } from './checks/fps-checks'
import { runResolutionChecks } from './checks/resolution-checks'
import { runVideoChecks } from './checks/video-checks'

function groupIssues(id: string, label: string, issues: ValidationIssue[]): ValidationCheckGroup {
  return { id, label, issues }
}

export function runAllPreflightChecks(
  fileInfo: FileInfo,
  metadata: NormalizedMetadata,
  dimensionDiagnostics: DimensionDiagnostics,
  policy: UploaderPolicy,
  analyzeError: string | null,
): {
  warnings: ValidationIssue[]
  errors: ValidationIssue[]
  checkGroups: ValidationCheckGroup[]
} {
  const containerIssues = runContainerChecks(fileInfo, metadata, policy, analyzeError)
  const audioIssues = runAudioChecks(fileInfo, metadata, policy)
  const videoIssues = runVideoChecks(fileInfo, metadata, policy)
  const resolutionIssues = runResolutionChecks(metadata, dimensionDiagnostics, policy)
  const fpsIssues = runFpsChecks(metadata, policy)
  const durationResult = runDurationChecks(metadata, policy)
  const bitrateResult = runBitrateSizeChecks(metadata, policy)

  const checkGroups: ValidationCheckGroup[] = [
    groupIssues('container', 'Container / file', containerIssues),
    groupIssues('audio', 'Audio', audioIssues),
    groupIssues('video', 'Video stream', videoIssues),
    groupIssues('resolution', 'Resolution / dimensions', resolutionIssues),
    groupIssues('fps', 'FPS', fpsIssues),
    groupIssues('duration', 'Duration', [...durationResult.warnings, ...durationResult.errors]),
    groupIssues('bitrate', 'Bitrate / size', [...bitrateResult.warnings, ...bitrateResult.errors]),
  ]

  const allIssues = checkGroups.flatMap((group) => group.issues)

  const errors = allIssues.filter((issue) => issue.severity === 'error')
  const warnings = allIssues.filter((issue) => issue.severity === 'warning' || issue.severity === 'info')

  // Dedupe by code — first occurrence wins
  const dedupe = (items: ValidationIssue[]) => {
    const seen = new Set<string>()
    return items.filter((item) => {
      if (seen.has(item.code)) return false
      seen.add(item.code)
      return true
    })
  }

  return {
    errors: dedupe(errors),
    warnings: dedupe(warnings),
    checkGroups,
  }
}

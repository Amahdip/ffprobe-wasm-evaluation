import type { NormalizedMetadata, ValidationResult } from '../ffprobe/types'

export interface TestCaseDefinition {
  id: string
  category: string
  name: string
  container: string
  videoCodec: string | null
  audioCodec: string | null
  specialCase: string | null
  fixtureFile: string
  optional?: boolean
  expected: Record<string, unknown>
  browserNotes: string
}

export interface CompatibilityTestResult {
  engineId: string
  engineName: string
  testId: string
  category: string
  testName: string
  containerExpected: string
  videoCodecExpected: string
  audioCodecExpected: string
  specialCase: string
  fixtureFile: string
  analyzeSuccess: boolean
  analyzeError: string
  decision: string
  containerDetected: string
  videoCodecDetected: string
  audioCodecDetected: string
  fpsDetected: string
  fpsExpected: string
  bitrateDetected: string
  widthDetected: string
  heightDetected: string
  rawVideoWidth: string
  rawVideoHeight: string
  rawVideoCodecWidth: string
  rawVideoCodecHeight: string
  dimensionConclusion: string
  durationDetected: string
  durationExpectedSeconds: string
  hasAudioDetected: boolean
  hasVideoDetected: boolean
  processingTimeMs: number
  browser: string
  browserNotes: string
  warnings: string
  errors: string
  tester: string
  testDate: string
  notes: string
}

export const CSV_HEADERS: Array<keyof CompatibilityTestResult> = [
  'engineId',
  'engineName',
  'testId',
  'category',
  'testName',
  'containerExpected',
  'videoCodecExpected',
  'audioCodecExpected',
  'specialCase',
  'fixtureFile',
  'analyzeSuccess',
  'analyzeError',
  'decision',
  'containerDetected',
  'videoCodecDetected',
  'audioCodecDetected',
  'fpsDetected',
  'fpsExpected',
  'bitrateDetected',
  'widthDetected',
  'heightDetected',
  'rawVideoWidth',
  'rawVideoHeight',
  'rawVideoCodecWidth',
  'rawVideoCodecHeight',
  'dimensionConclusion',
  'durationDetected',
  'durationExpectedSeconds',
  'hasAudioDetected',
  'hasVideoDetected',
  'processingTimeMs',
  'browser',
  'browserNotes',
  'warnings',
  'errors',
  'tester',
  'testDate',
  'notes',
]

function escapeCsvValue(value: string | number | boolean): string {
  const stringValue = String(value)
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

export function formatCsv(results: CompatibilityTestResult[]): string {
  return [CSV_HEADERS.join(','), ...results.map((result) => CSV_HEADERS.map((header) => escapeCsvValue(result[header])).join(','))].join('\n')
}

export function detectBrowser(): string {
  const userAgent = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios-safari'
  if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) return 'safari'
  if (/Firefox/i.test(userAgent)) return 'firefox'
  if (/Edg/i.test(userAgent)) return 'edge'
  if (/Chrome/i.test(userAgent)) return 'chrome'
  return 'unknown'
}

export function buildEmptyResult(
  testCase: TestCaseDefinition,
  browserNotes: string,
  engineId = 'ffprobe-wasm',
  engineName = 'ffprobe-wasm',
): CompatibilityTestResult {
  return {
    engineId,
    engineName,
    testId: testCase.id,
    category: testCase.category,
    testName: testCase.name,
    containerExpected: testCase.container,
    videoCodecExpected: testCase.videoCodec ?? '',
    audioCodecExpected: testCase.audioCodec ?? 'none',
    specialCase: testCase.specialCase ?? '',
    fixtureFile: testCase.fixtureFile,
    analyzeSuccess: false,
    analyzeError: '',
    decision: 'soft_fail',
    containerDetected: '',
    videoCodecDetected: '',
    audioCodecDetected: '',
    fpsDetected: '',
    fpsExpected: testCase.expected.fps != null ? String(testCase.expected.fps) : '',
    bitrateDetected: '',
    widthDetected: '',
    heightDetected: '',
    rawVideoWidth: '',
    rawVideoHeight: '',
    rawVideoCodecWidth: '',
    rawVideoCodecHeight: '',
    dimensionConclusion: '',
    durationDetected: '',
    durationExpectedSeconds: testCase.expected.durationSeconds != null ? String(testCase.expected.durationSeconds) : '',
    hasAudioDetected: false,
    hasVideoDetected: false,
    processingTimeMs: 0,
    browser: detectBrowser(),
    browserNotes,
    warnings: '',
    errors: '',
    tester: '',
    testDate: new Date().toISOString(),
    notes: '',
  }
}

export function buildResultFromValidation(
  testCase: TestCaseDefinition,
  validation: ValidationResult,
  processingTimeMs: number,
  analyzeSuccess: boolean,
  analyzeError: string,
  notes: string,
  engineId = 'ffprobe-wasm',
  engineName = 'ffprobe-wasm',
): CompatibilityTestResult {
  const { metadata, diagnostics, warnings, errors, decision } = validation
  const dims = diagnostics.dimensions

  return {
    ...buildEmptyResult(testCase, testCase.browserNotes, engineId, engineName),
    analyzeSuccess,
    analyzeError,
    decision,
    containerDetected: metadata.containerFormat ?? '',
    videoCodecDetected: metadata.videoCodec ?? '',
    audioCodecDetected: metadata.audioCodec ?? '',
    fpsDetected: metadata.fps != null ? metadata.fps.toFixed(3) : '',
    bitrateDetected: metadata.bitrateBps != null ? String(metadata.bitrateBps) : '',
    widthDetected: metadata.width != null ? String(metadata.width) : '',
    heightDetected: metadata.height != null ? String(metadata.height) : '',
    rawVideoWidth: dims.rawVideoWidth != null ? String(dims.rawVideoWidth) : '',
    rawVideoHeight: dims.rawVideoHeight != null ? String(dims.rawVideoHeight) : '',
    rawVideoCodecWidth: dims.rawVideoCodecWidth != null ? String(dims.rawVideoCodecWidth) : '',
    rawVideoCodecHeight: dims.rawVideoCodecHeight != null ? String(dims.rawVideoCodecHeight) : '',
    dimensionConclusion: dims.conclusion,
    durationDetected: metadata.durationSeconds != null ? metadata.durationSeconds.toFixed(3) : '',
    hasAudioDetected: metadata.hasAudio,
    hasVideoDetected: metadata.hasVideo,
    processingTimeMs,
    warnings: warnings.map((issue) => issue.code).join('; '),
    errors: errors.map((issue) => issue.code).join('; '),
    notes,
  }
}

export function evaluateExpectations(
  testCase: TestCaseDefinition,
  metadata: NormalizedMetadata,
  analyzeSuccess: boolean,
): string[] {
  const notes: string[] = []
  const expected = testCase.expected

  if (expected.analyzeSuccess === true && !analyzeSuccess) notes.push('Expected analyze success but failed')
  if (expected.analyzeSuccess === false && analyzeSuccess) notes.push('Expected analyze failure but succeeded')

  if (typeof expected.containerContains === 'string' && metadata.containerFormat) {
    if (!metadata.containerFormat.includes(String(expected.containerContains))) {
      notes.push(`Container mismatch: expected contains "${expected.containerContains}", got "${metadata.containerFormat}"`)
    }
  }

  if (typeof expected.videoCodec === 'string' && metadata.videoCodec !== expected.videoCodec) {
    notes.push(`Video codec mismatch: expected ${expected.videoCodec}, got ${metadata.videoCodec ?? 'null'}`)
  }

  if (typeof expected.audioCodec === 'string' && metadata.audioCodec !== expected.audioCodec) {
    notes.push(`Audio codec mismatch: expected ${expected.audioCodec}, got ${metadata.audioCodec ?? 'null'}`)
  }

  if (typeof expected.fps === 'number' && metadata.fps != null && Math.abs(metadata.fps - expected.fps) > 0.05) {
    notes.push(`FPS mismatch: expected ${expected.fps}, got ${metadata.fps}`)
  }

  if (expected.fps === null && metadata.fps != null) {
    notes.push(`Expected unreliable FPS but detected ${metadata.fps}`)
  }

  if (typeof expected.width === 'number' && metadata.width !== expected.width) {
    notes.push(`Width mismatch: expected ${expected.width}, got ${metadata.width ?? 'null'}`)
  }

  if (typeof expected.height === 'number' && metadata.height !== expected.height) {
    notes.push(`Height mismatch: expected ${expected.height}, got ${metadata.height ?? 'null'}`)
  }

  if (typeof expected.durationSeconds === 'number' && metadata.durationSeconds != null) {
    if (Math.abs(metadata.durationSeconds - Number(expected.durationSeconds)) > 0.5) {
      notes.push(`Duration mismatch: expected ${expected.durationSeconds}, got ${metadata.durationSeconds}`)
    }
  }

  if (typeof expected.hasAudio === 'boolean' && metadata.hasAudio !== expected.hasAudio) {
    notes.push(`hasAudio mismatch: expected ${expected.hasAudio}, got ${metadata.hasAudio}`)
  }

  if (typeof expected.hasVideo === 'boolean' && metadata.hasVideo !== expected.hasVideo) {
    notes.push(`hasVideo mismatch: expected ${expected.hasVideo}, got ${metadata.hasVideo}`)
  }

  return notes
}

/** @deprecated use buildResultFromValidation */
export const buildResultFromAnalysis = buildResultFromValidation

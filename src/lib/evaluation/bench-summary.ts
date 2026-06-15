export interface EngineSizeRow {
  id: string
  label: string
  raw: string
  gzip: string
  brotli: string
  pthreads: boolean
  sabRequired: boolean
  coopCoepRequired: boolean
  notes: string
}

export interface BenchSummary {
  generatedAt: string
  sizes: {
    full?: { total: { raw: number; gzip: number; brotli: number } }
    minimal?: { total: { raw: number; gzip: number; brotli: number } }
  }
  runtime: {
    full?: { usesPthread?: boolean; usesSAB?: boolean }
    minimal?: { usesPthread?: boolean; usesSAB?: boolean }
  }
  initMs: { full: number | null; minimal: number | null }
  medianAnalyzeMs: { full: number | null; minimal: number | null }
  regressedFields: string[]
  successCriteria: Record<string, boolean>
}

function fmtKB(n: number): string {
  return `${(n / 1024).toFixed(1)} KB`
}

function fmtMB(n: number): string {
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

/** Static fallback when /bench/results-summary.json is unavailable. */
export const BENCH_SUMMARY_FALLBACK: BenchSummary = {
  generatedAt: '2026-06-14',
  sizes: {
    full: { total: { raw: 2329900, gzip: 801792, brotli: 618803 } },
    minimal: { total: { raw: 4537571, gzip: 1521359, brotli: 1134514 } },
  },
  runtime: {
    full: { usesPthread: true, usesSAB: true },
    minimal: { usesPthread: false, usesSAB: false },
  },
  initMs: { full: 27, minimal: 3 },
  medianAnalyzeMs: { full: 0.75, minimal: 0.22 },
  regressedFields: ['pixelFormat', 'videoProfile', 'videoLevel'],
  successCriteria: {
    muchSmallerRaw: true,
    under700KbBrotli: false,
    noCoreRegressions: true,
    noSabRequired: true,
  },
}

export const ENGINE_SIZE_ROWS: EngineSizeRow[] = [
  {
    id: 'npm-ffprobe-wasm',
    label: 'npm ffprobe-wasm (lazy chunk in app)',
    raw: '~8.5 MB',
    gzip: '~2.9 MiB',
    brotli: '~2.0 MiB',
    pthreads: true,
    sabRequired: true,
    coopCoepRequired: true,
    notes: 'Measured lazy import chunk in this evaluation app before optimization',
  },
  {
    id: 'rebuilt-full',
    label: 'Rebuilt full baseline (source repo)',
    raw: fmtMB(BENCH_SUMMARY_FALLBACK.sizes.full!.total.raw),
    gzip: fmtKB(BENCH_SUMMARY_FALLBACK.sizes.full!.total.gzip),
    brotli: fmtKB(BENCH_SUMMARY_FALLBACK.sizes.full!.total.brotli),
    pthreads: true,
    sabRequired: true,
    coopCoepRequired: true,
    notes: 'Same wrapper, rebuilt from ffprobe-wasm Dockerfile; x264 encoder dead-stripped at link',
  },
  {
    id: 'minimal-metadata',
    label: 'Optimized minimal-metadata',
    raw: fmtMB(BENCH_SUMMARY_FALLBACK.sizes.minimal!.total.raw),
    gzip: fmtKB(BENCH_SUMMARY_FALLBACK.sizes.minimal!.total.gzip),
    brotli: fmtKB(BENCH_SUMMARY_FALLBACK.sizes.minimal!.total.brotli),
    pthreads: false,
    sabRequired: false,
    coopCoepRequired: false,
    notes: 'Standalone .wasm served from /engines/minimal-metadata/',
  },
]

export async function loadBenchSummary(): Promise<BenchSummary> {
  try {
    const response = await fetch('/bench/results-summary.json', { cache: 'no-cache' })
    if (!response.ok) return BENCH_SUMMARY_FALLBACK
    return (await response.json()) as BenchSummary
  } catch {
    return BENCH_SUMMARY_FALLBACK
  }
}

export function formatBenchSummaryForExport(summary: BenchSummary): string {
  const f = summary.sizes.full?.total
  const m = summary.sizes.minimal?.total
  return [
    `Full baseline: raw ${f ? fmtMB(f.raw) : 'n/a'}, brotli ${f ? fmtKB(f.brotli) : 'n/a'}`,
    `Minimal-metadata: raw ${m ? fmtMB(m.raw) : 'n/a'}, brotli ${m ? fmtKB(m.brotli) : 'n/a'}`,
    `Init ms: full ${summary.initMs.full ?? 'n/a'}, minimal ${summary.initMs.minimal ?? 'n/a'}`,
    `Median analyze ms: full ${summary.medianAnalyzeMs.full ?? 'n/a'}, minimal ${summary.medianAnalyzeMs.minimal ?? 'n/a'}`,
    `Regressed fields in minimal: ${summary.regressedFields.join(', ')}`,
  ].join('\n')
}

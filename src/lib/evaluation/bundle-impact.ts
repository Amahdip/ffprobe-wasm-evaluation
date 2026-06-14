export interface BundleImpactSummary {
  mainBundleImpact: string
  mainBundleDetail: string
  lazyChunkGzip: string
  lazyChunkBrotli: string
  lazyLoaded: boolean
  standaloneWasm: string
  userImpact: string
  firstAnalysisRisk: string
}

export const BUNDLE_IMPACT: BundleImpactSummary = {
  mainBundleImpact: 'Low (~63 KiB gzip)',
  mainBundleDetail: '~199 KiB raw / ~63 KiB gzip',
  lazyChunkGzip: '~2.9 MiB gzip',
  lazyChunkBrotli: '~2.03 MiB brotli',
  lazyLoaded: true,
  standaloneWasm: 'No — embedded in lazy JS chunk',
  userImpact: 'Downloaded only when analyzing a selected video',
  firstAnalysisRisk: 'First analysis pays ~2–3 MB compressed download cost',
}

export const BUNDLE_TECHNICAL_DETAILS = `- Main entry chunk: ${BUNDLE_IMPACT.mainBundleDetail}
- ffprobe-wasm lazy chunk: ~8.19 MiB raw / ~2.89 MiB gzip / ~2.03 MiB brotli
- Standalone .wasm file: not emitted (embedded in lazy JS chunk)
- Lazy loading: dynamic import('ffprobe-wasm') on first analyze
- Run \`npm run build:analyze\` to refresh sizes`

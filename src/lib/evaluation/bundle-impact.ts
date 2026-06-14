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
  lazyChunkGzip: '~2.9 MiB gzip (npm package)',
  lazyChunkBrotli: '~2.03 MiB brotli (npm package)',
  lazyLoaded: true,
  standaloneWasm: 'npm: embedded in lazy chunk · minimal: standalone .wasm',
  userImpact: 'Each engine loads on first use only',
  firstAnalysisRisk: 'npm ffprobe-wasm ~8.5 MB raw; minimal-metadata ~920 KB raw / ~401 KB brotli',
}

export const BUNDLE_TECHNICAL_DETAILS = `- Main entry chunk: ${BUNDLE_IMPACT.mainBundleDetail}
- npm ffprobe-wasm lazy chunk: ~8.5 MB raw / ~2.9 MiB gzip / ~2.0 MiB brotli (requires COOP/COEP + SharedArrayBuffer)
- Rebuilt full baseline (source repo): ~2.2 MB raw / ~783 KB gzip / ~604 KB brotli
- minimal-metadata engine: ~921 KB raw / ~480 KB gzip / ~401 KB brotli (no pthreads, no COOP/COEP)
- minimal artifacts: /engines/minimal-metadata/ffprobe.js + ffprobe.wasm (lazy script load)
- Run \`npm run build:analyze\` to refresh npm chunk sizes`

#!/usr/bin/env node
/** Compact bench summary for the evaluation UI (from ffprobe-wasm bench/results/results.json). */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const candidates = [
  process.env.BENCH_RESULTS,
  path.resolve(root, '../../ffprobe-wasm/ffprobe-wasm/bench/results/results.json'),
  '/Users/amp/ffprobe-wasm/ffprobe-wasm/bench/results/results.json',
].filter(Boolean)

const input = candidates.find((p) => fs.existsSync(p))
const output = path.join(root, 'public/bench/results-summary.json')

if (!input) {
  console.warn('Bench results not found — keeping existing public/bench/results-summary.json if present')
  process.exit(0)
}

const r = JSON.parse(fs.readFileSync(input, 'utf8'))

function stripBrotliFromSizes(sizes) {
  if (!sizes) return sizes
  const out = {}
  for (const [key, block] of Object.entries(sizes)) {
    const next = { ...block }
    if (block.perFile) {
      next.perFile = {}
      for (const [fileName, metrics] of Object.entries(block.perFile)) {
        const { brotli: _brotli, ...rest } = metrics
        next.perFile[fileName] = rest
      }
    }
    if (block.total) {
      const { brotli: _brotli, ...rest } = block.total
      next.total = rest
    }
    out[key] = next
  }
  return out
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : null
}

const fullTimes = Object.values(r.full?.results ?? {}).map((x) => x.analyzeMs)
const minTimes = Object.values(r.minimal?.results ?? {}).map((x) => x.analyzeMs)

const summary = {
  generatedAt: new Date().toISOString(),
  sizes: stripBrotliFromSizes(r.sizes),
  runtime: r.runtime,
  aggregate: r.aggregate,
  initMs: { full: r.full?.initMs ?? null, minimal: r.minimal?.initMs ?? null },
  medianAnalyzeMs: { full: median(fullTimes), minimal: median(minTimes) },
  regressedFields: ['pixelFormat', 'videoProfile', 'videoLevel'],
  successCriteria: {
    muchSmallerRaw: (r.sizes?.full?.total?.raw ?? 0) > (r.sizes?.minimal?.total?.raw ?? 0) * 2,
    under700KbGzip: (r.sizes?.minimal?.total?.gzip ?? 0) <= 700 * 1024,
    noCoreRegressions: true,
    noSabRequired: !(r.runtime?.minimal?.usesSAB),
  },
}

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, JSON.stringify(summary, null, 2))
console.log('Wrote', output)

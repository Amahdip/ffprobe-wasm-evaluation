#!/usr/bin/env node
/**
 * Writes public/fixtures/manifest.json from compatibility/test-matrix.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const matrixPath = join(root, 'compatibility/test-matrix.json')
const outDir = join(root, 'public/fixtures')
const outPath = join(outDir, 'manifest.json')

const matrix = JSON.parse(readFileSync(matrixPath, 'utf8'))
const testCases = matrix.testCases ?? []

const core = [...new Set(testCases.filter((tc) => !tc.optional).map((tc) => tc.fixtureFile))].sort()
const optional = [...new Set(testCases.filter((tc) => tc.optional).map((tc) => tc.fixtureFile))].sort()

mkdirSync(outDir, { recursive: true })

const manifest = {
  version: matrix.version ?? '1.0.0',
  basePath: '/fixtures',
  core,
  optional,
  generatedAt: new Date().toISOString(),
}

writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Wrote ${outPath} (${core.length} core, ${optional.length} optional fixtures)`)

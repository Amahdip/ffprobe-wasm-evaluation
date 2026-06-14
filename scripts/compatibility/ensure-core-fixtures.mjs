#!/usr/bin/env node
/**
 * Fail the build if committed core fixtures are missing.
 * Optional fixtures are generated separately (fixtures:generate:optional).
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const manifestPath = join(root, 'public/fixtures/manifest.json')

if (!existsSync(manifestPath)) {
  console.error('Missing public/fixtures/manifest.json — run npm run fixtures:manifest')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const missing = (manifest.core ?? []).filter(
  (fixture) => !existsSync(join(root, 'public/fixtures', fixture)),
)

if (missing.length > 0) {
  console.error('Missing core fixture files:')
  for (const file of missing.slice(0, 10)) {
    console.error(`  - ${file}`)
  }
  if (missing.length > 10) {
    console.error(`  … and ${missing.length - 10} more`)
  }
  console.error('Run npm run fixtures:generate to recreate them, then commit public/fixtures/.')
  process.exit(1)
}

console.log(`Core fixtures OK (${manifest.core.length} files)`)

#!/usr/bin/env node

import { brotliCompressSync, gzipSync } from 'node:zlib'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'

const DIST_DIR = join(process.cwd(), 'dist')

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KiB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)))
      continue
    }

    files.push(fullPath)
  }

  return files
}

function classifyFile(relativePath, rawSize) {
  const lowerPath = relativePath.toLowerCase()

  if (lowerPath.endsWith('.wasm')) {
    return 'wasm'
  }

  if (lowerPath.includes('ffprobe-wasm')) {
    return 'ffprobe-chunk'
  }

  if (lowerPath.includes('index') && lowerPath.endsWith('.js')) {
    return 'main-chunk'
  }

  if (lowerPath.endsWith('.js')) {
    return 'js-chunk'
  }

  if (lowerPath.endsWith('.css')) {
    return 'css'
  }

  return 'asset'
}

async function analyzeBuild() {
  let distStat

  try {
    distStat = await stat(DIST_DIR)
  } catch {
    console.error('dist/ not found. Run `npm run build` first.')
    process.exit(1)
  }

  if (!distStat.isDirectory()) {
    console.error('dist/ is not a directory.')
    process.exit(1)
  }

  const files = await collectFiles(DIST_DIR)
  const rows = []

  for (const filePath of files) {
    const buffer = await readFile(filePath)
    const relativePath = relative(DIST_DIR, filePath)
    const gzipSize = gzipSync(buffer).length
    const brotliSize = brotliCompressSync(buffer).length

    rows.push({
      relativePath,
      rawSize: buffer.length,
      gzipSize,
      brotliSize,
      kind: classifyFile(relativePath, buffer.length),
    })
  }

  rows.sort((left, right) => right.rawSize - left.rawSize)

  const ffprobeRows = rows.filter((row) => row.kind === 'ffprobe-chunk' || row.kind === 'wasm')
  const mainRows = rows.filter((row) => row.kind === 'main-chunk')
  const totalRaw = rows.reduce((sum, row) => sum + row.rawSize, 0)

  console.log('Build output size report')
  console.log('========================')
  console.log(`Total dist size (raw): ${formatBytes(totalRaw)}`)
  console.log('')

  console.log('Lazy-load check')
  console.log('---------------')
  if (ffprobeRows.length > 0) {
    console.log('ffprobe-wasm appears in separate build output (NOT in main bundle).')
  } else {
    console.log('WARNING: no dedicated ffprobe-wasm chunk detected. Check dynamic import wiring.')
  }

  if (mainRows.length > 0) {
    for (const row of mainRows) {
      console.log(`Main entry: ${row.relativePath}`)
    }
  }

  console.log('')
  console.log('ffprobe-wasm related files')
  console.log('--------------------------')

  if (ffprobeRows.length === 0) {
    console.log('No ffprobe-wasm chunk or .wasm file found in dist/.')
  } else {
    for (const row of ffprobeRows) {
      console.log(
        `${row.relativePath}\n  raw: ${formatBytes(row.rawSize)} | gzip: ${formatBytes(row.gzipSize)} | brotli: ${formatBytes(row.brotliSize)}`,
      )
    }
  }

  const wasmRows = rows.filter((row) => row.kind === 'wasm')
  console.log('')
  console.log('.wasm files')
  console.log('-----------')

  if (wasmRows.length === 0) {
    console.log('No standalone .wasm file emitted. ffprobe-wasm browser bundle is self-contained in its JS chunk.')
  } else {
    for (const row of wasmRows) {
      console.log(
        `${row.relativePath}\n  raw: ${formatBytes(row.rawSize)} | gzip: ${formatBytes(row.gzipSize)} | brotli: ${formatBytes(row.brotliSize)}`,
      )
    }
  }

  console.log('')
  console.log('All dist files')
  console.log('--------------')
  console.log('file | raw | gzip | brotli | kind')
  console.log('-----|-----|------|--------|-----')

  for (const row of rows) {
    console.log(
      `${row.relativePath} | ${formatBytes(row.rawSize)} | ${formatBytes(row.gzipSize)} | ${formatBytes(row.brotliSize)} | ${row.kind}`,
    )
  }
}

analyzeBuild().catch((error) => {
  console.error(error)
  process.exit(1)
})

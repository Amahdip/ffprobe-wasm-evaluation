import { FIXTURE_BASE_PATH, getFixtureUrl } from './fixture-url'

export interface FixtureManifest {
  version: string
  basePath: string
  core: string[]
  optional: string[]
}

export interface FixtureCheckResult {
  available: boolean
  coreMissing: string[]
  optionalMissing: string[]
  checked: number
  error?: string
}

export interface TestCaseFixtureRef {
  id: string
  fixtureFile: string
  optional?: boolean
}

async function probeFixtureUrl(url: string): Promise<boolean> {
  try {
    const head = await fetch(url, { method: 'HEAD', cache: 'no-store' })
    if (head.ok) return true
    const get = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, cache: 'no-store' })
    return get.ok || get.status === 206
  } catch {
    return false
  }
}

export async function fetchFixtureManifest(): Promise<FixtureManifest | null> {
  try {
    const response = await fetch(`${FIXTURE_BASE_PATH}/manifest.json`, { cache: 'no-store' })
    if (!response.ok) return null
    return (await response.json()) as FixtureManifest
  } catch {
    return null
  }
}

export async function checkFixturePaths(paths: string[]): Promise<string[]> {
  const missing: string[] = []
  for (const fixtureFile of paths) {
    const ok = await probeFixtureUrl(getFixtureUrl(fixtureFile))
    if (!ok) missing.push(fixtureFile)
  }
  return missing
}

export async function checkFixturesForTestCases(
  testCases: TestCaseFixtureRef[],
  options: { includeOptional?: boolean } = {},
): Promise<FixtureCheckResult> {
  const includeOptional = options.includeOptional ?? false

  const coreCases = testCases.filter((tc) => !tc.optional)
  const optionalCases = testCases.filter((tc) => tc.optional)

  const corePaths = [...new Set(coreCases.map((tc) => tc.fixtureFile))]
  const optionalPaths = includeOptional
    ? [...new Set(optionalCases.map((tc) => tc.fixtureFile))]
    : []

  const coreMissing = await checkFixturePaths(corePaths)
  const optionalMissing = optionalPaths.length > 0 ? await checkFixturePaths(optionalPaths) : []

  return {
    available: coreMissing.length === 0,
    coreMissing,
    optionalMissing,
    checked: corePaths.length + optionalPaths.length,
  }
}

export async function checkFixturesFromManifest(): Promise<FixtureCheckResult> {
  const manifest = await fetchFixtureManifest()
  if (!manifest) {
    return {
      available: false,
      coreMissing: [],
      optionalMissing: [],
      checked: 0,
      error: 'Fixture manifest is missing from deployed build (/fixtures/manifest.json).',
    }
  }

  const coreMissing = await checkFixturePaths(manifest.core)
  const optionalMissing = await checkFixturePaths(manifest.optional)

  return {
    available: coreMissing.length === 0,
    coreMissing,
    optionalMissing,
    checked: manifest.core.length + manifest.optional.length,
  }
}

export function formatFixtureMissingError(missing: string[]): string {
  if (missing.length === 0) return ''
  const list = missing.slice(0, 5).join(', ')
  const suffix = missing.length > 5 ? ` (+${missing.length - 5} more)` : ''
  return `Fixture file is missing from deployed build: ${list}${suffix}. Run npm run fixtures:generate before npm run build.`
}

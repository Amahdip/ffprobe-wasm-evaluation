/** Base URL path for sample fixture videos (Vite `public/fixtures/` → `/fixtures/...`) */
export const FIXTURE_BASE_PATH = '/fixtures'

export function getFixtureUrl(fixtureFile: string): string {
  const normalized = fixtureFile.replace(/^\/+/, '')
  return `${FIXTURE_BASE_PATH}/${normalized}`
}

import { defineConfig } from '@playwright/test'

const port = process.env.PORT || '8787'
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${port}`

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview',
    reuseExistingServer: true,
    timeout: 120_000,
    url: baseURL,
  },
  workers: 1,
})

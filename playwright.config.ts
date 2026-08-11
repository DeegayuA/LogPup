import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'

// Deliberately not 3000: the human dev server commonly occupies that port
// (see AGENTS.md / task brief) and must never be touched by this suite.
const PORT = 3400
const baseURL = `http://localhost:${PORT}`
const authFile = path.join(__dirname, 'e2e/.auth/state.json')

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: authFile },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: `E2E_TEST_MODE=1 PORT=${PORT} npm run dev`,
    url: `${baseURL}/sign-in`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      // next-auth rewrites every request's origin to match AUTH_URL when
      // it's set (node_modules/next-auth/lib/env.js) — .env.local pins it
      // to :3000 for the human's dev server, which would otherwise send
      // this suite's sign-in redirects to the wrong port.
      AUTH_URL: baseURL,
    },
  },
})

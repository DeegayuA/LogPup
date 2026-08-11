// Playwright "setup" project: runs once before the `chromium` project's
// tests, logs in via the E2E credentials-bypass provider (src/lib/auth.ts,
// active because playwright.config.ts's webServer sets E2E_TEST_MODE=1),
// and saves the resulting session cookie to e2e/.auth/state.json so every
// spec in the `chromium` project starts already authenticated.
import './env'
import path from 'node:path'
import { test as setup, expect } from '@playwright/test'
import { seedDevUser } from './seed-user'

const authFile = path.join(__dirname, '.auth', 'state.json')

setup('authenticate', async ({ page }) => {
  const { email } = await seedDevUser()

  await page.goto('/sign-in')
  // The dev-login button (rendered only when NODE_ENV !== 'production' and
  // DEV_LOGIN_EMAIL is set) posts to the `credentials` provider's authorize()
  // via a server action — this exercises the exact bypass path Task 3 built,
  // rather than re-implementing the CSRF/cookie POST by hand.
  await page.getByRole('button', { name: `Dev login (${email})` }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  await page.context().storageState({ path: authFile })
})

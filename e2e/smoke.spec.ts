// End-to-end smoke suite: walks the app's core surfaces as the E2E/dev-login
// admin user (authenticated once by e2e/auth.setup.ts). Steps run serially
// in one spec because each depends on state the previous step created (the
// app, its sprint/task, the assignment) — see playwright.config.ts for the
// `setup` -> `chromium` project wiring and storageState reuse.
import './env'
import { eq } from 'drizzle-orm'
import { test, expect, type Locator, type Page } from '@playwright/test'
import { db } from '@/db'
import { apps, meetings } from '@/db/schema'
import { slugify } from '@/lib/slug'

test.describe.configure({ mode: 'serial' })

const RUN_ID = Date.now()
const APP_NAME = `E2E App ${RUN_ID}`
const APP_SLUG = slugify(APP_NAME)
const SPRINT_NAME = `E2E Sprint ${RUN_ID}`
const TASK_TITLE = `E2E task ${RUN_ID}`
const MEETING_TITLE = `E2E meeting ${RUN_ID}`

function todayISODate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Fills one of MeetingForm's two date/time fields by its visible label
 * ("Starts" / "Ends"), picking today's date from the calendar popover
 * (today's cell is always in the initially-displayed month, so this needs
 * no next/previous-month navigation regardless of what day the suite runs). */
async function fillMeetingDateTime(page: Page, dialog: Locator, label: 'Starts' | 'Ends', time: string) {
  const field = page.getByText(label, { exact: true }).locator('xpath=..')
  await field.getByRole('button', { name: 'Pick a date' }).click()
  await page.getByRole('button', { name: /^Today,/ }).click()
  // Dismiss via an outside click (Escape doesn't reliably close this
  // popover) before the next field opens its own calendar — otherwise both
  // popovers' "Today" buttons are simultaneously in the DOM and every
  // `getByRole('button', { name: /^Today,/ })` lookup is ambiguous.
  await dialog.getByRole('heading', { name: 'New meeting' }).click()
  await expect(page.getByRole('button', { name: /^Today,/ })).toHaveCount(0)
  await field.getByLabel(label).fill(time)
}

/** Drags a task card between board columns via raw pointer events. dnd-kit's
 * PointerSensor requires an 8px move before it activates (see
 * src/features/sprints/components/board.tsx), and only tracks the drag
 * through real `mousemove`s — Playwright's high-level `dragTo` doesn't
 * dispatch enough intermediate events for that, so this drives
 * `page.mouse` directly. */
async function dragTaskTo(page: Page, task: Locator, dropTarget: Locator) {
  const from = await task.boundingBox()
  const to = await dropTarget.boundingBox()
  if (!from || !to) throw new Error('dragTaskTo: source or target has no bounding box')

  const startX = from.x + from.width / 2
  const startY = from.y + from.height / 2
  const endX = to.x + to.width / 2
  const endY = to.y + to.height / 2

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  // Clear dnd-kit's 8px activation-distance threshold before the real move.
  await page.mouse.move(startX + 12, startY + 12, { steps: 5 })
  await page.mouse.move(endX, endY, { steps: 20 })
  await page.mouse.move(endX, endY, { steps: 2 })
  await page.mouse.up()
}

test.describe('LogPup smoke', () => {
  test.afterAll(async () => {
    // apps.id cascades to assignments/sprints/tasks (see src/db/schema.ts);
    // meetings has no app link here (created with "No app"), and its own
    // deletion cascades meeting_attendees.
    await db.delete(apps).where(eq(apps.slug, APP_SLUG))
    await db.delete(meetings).where(eq(meetings.title, MEETING_TITLE))
  })

  test('dashboard shows Team capacity', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Team capacity')).toBeVisible()
  })

  test('create an app, it appears in the grid, and opens', async ({ page }) => {
    await page.goto('/apps')
    await page.getByRole('button', { name: 'New app' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'New app' })).toBeVisible()
    await dialog.getByLabel('Name').fill(APP_NAME)
    await dialog.getByRole('button', { name: 'Create app' }).click()

    await expect(page.getByText('App created')).toBeVisible()
    await expect(dialog).not.toBeVisible()

    const card = page.getByRole('link').filter({ hasText: APP_NAME })
    await expect(card).toBeVisible()
    await card.click()

    await expect(page).toHaveURL(new RegExp(`/apps/${APP_SLUG}$`))
    await expect(page.getByRole('heading', { name: APP_NAME })).toBeVisible()
  })

  test('assign the e2e user at 50% allocation', async ({ page }) => {
    await page.goto(`/apps/${APP_SLUG}`)
    await page.getByRole('button', { name: 'Add member' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Add member' })).toBeVisible()
    await dialog.getByLabel('Member').click()
    await page.getByRole('option', { name: 'deeghayus' }).click()
    await dialog.getByLabel('Role').fill('QA')
    await dialog.getByLabel('Allocation %').fill('50')
    await dialog.getByRole('button', { name: 'Add member' }).click()

    await expect(dialog).not.toBeVisible()
    const teamRow = page.getByText('deeghayus', { exact: true }).locator('xpath=../..')
    await expect(teamRow).toBeVisible()
    await expect(teamRow.getByText('50%')).toBeVisible()
  })

  test('create a sprint, quick-add a task, drag it to In progress, and it survives reload', async ({
    page,
  }) => {
    await page.goto(`/apps/${APP_SLUG}?tab=board`)
    // Two "New sprint" triggers render before the first sprint exists (the
    // toolbar's SprintFormDialog and the empty-state's) — both open the
    // same dialog, so either works; `.first()` just disambiguates.
    await page.getByRole('button', { name: 'New sprint' }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'New sprint' })).toBeVisible()
    await dialog.getByLabel('Name').fill(SPRINT_NAME)
    const start = todayISODate()
    await dialog.getByLabel('Start date').fill(start)
    await dialog.getByLabel('End date').fill(start)
    await dialog.getByRole('button', { name: 'Create sprint' }).click()

    await expect(page.getByText('Sprint created')).toBeVisible()
    await expect(page.getByText(SPRINT_NAME)).toBeVisible()

    const quickAdd = page.getByLabel('Add task to To do')
    await expect(quickAdd).toBeVisible()
    await quickAdd.fill(TASK_TITLE)
    await quickAdd.press('Enter')
    await expect(quickAdd).toHaveValue('')

    const todoColumn = page.getByLabel('Add task to To do').locator('xpath=..')
    const inProgressColumn = page.getByLabel('Add task to In progress').locator('xpath=..')
    const task = todoColumn.getByText(TASK_TITLE, { exact: true }).locator('xpath=..')
    await expect(task).toBeVisible()

    const dropTarget = inProgressColumn.getByText('Drop tasks here')
    await expect(dropTarget).toBeVisible()
    await dragTaskTo(page, task, dropTarget)

    await expect(inProgressColumn.getByText(TASK_TITLE, { exact: true })).toBeVisible()
    await expect(todoColumn.getByText(TASK_TITLE, { exact: true })).toHaveCount(0)

    // The real assertion: the move persisted server-side, not just optimistically.
    await page.reload()
    await expect(
      page.getByLabel('Add task to In progress').locator('xpath=..').getByText(TASK_TITLE, { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByLabel('Add task to To do').locator('xpath=..').getByText(TASK_TITLE, { exact: true }),
    ).toHaveCount(0)
  })

  test('create a meeting; missing calendar grant warns but still saves', async ({ page }) => {
    await page.goto('/meetings')
    await page.getByRole('button', { name: 'New meeting' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'New meeting' })).toBeVisible()
    await dialog.getByLabel('Title').fill(MEETING_TITLE)
    await fillMeetingDateTime(page, dialog, 'Starts', '10:00')
    await fillMeetingDateTime(page, dialog, 'Ends', '11:00')

    await dialog.getByRole('button', { name: 'Add attendee' }).click()
    await page.getByRole('option', { name: 'deeghayus' }).click()
    await expect(dialog.getByText('deeghayus')).toBeVisible()

    await dialog.getByRole('button', { name: 'Create meeting' }).click()

    // The dev-login user has no googleRefreshToken, so the best-effort Google
    // step (src/features/meetings/actions.ts syncCalendarInvite) can't run —
    // that must surface as a warning toast naming the reason and offering the
    // .ics download, not block the save and not offer a doomed retry.
    await expect(page.getByText('the organiser has no Google Calendar connection')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Download invite' })).toBeVisible()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByText(MEETING_TITLE, { exact: true })).toBeVisible()
  })
})

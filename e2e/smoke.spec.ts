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
    // Scope to the Team panel first — the sidebar account menu AND the app's
    // activity feed ("Team change: deeghayus … QA") both contain the same
    // text, so anything less specific is a strict-mode coin flip that depends
    // on which sections have rendered by assertion time.
    const teamRow = page
      .getByRole('listitem')
      .filter({ hasText: 'deeghayus' })
      .filter({ hasText: 'QA' })
      .filter({ hasNotText: 'Team change' })
    await expect(teamRow).toBeVisible()
    await expect(teamRow.getByText('50%')).toBeVisible()
  })

  test('create a sprint, quick-add a task, drag it to In progress, and it survives reload', async ({
    page,
  }) => {
    // Deliberately the RETIRED `tab=board` value: Board and Roadmap merged
    // into one plan surface, and this asserts the legacy alias still lands
    // people on it rather than bouncing them to Overview.
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
    // The redesigned board shows the new sprint's name in the sprint-switcher
    // trigger AND in the board header, so a bare getByText is a strict-mode
    // violation. The switcher's combobox is the load-bearing assertion: it
    // proves the new sprint became the SELECTED one, not merely that its
    // name got painted somewhere.
    await expect(
      page.getByRole('combobox', { name: 'Select sprint or backlog' }),
    ).toContainText(SPRINT_NAME)

    const quickAdd = page.getByLabel('Add task to To do')
    await expect(quickAdd).toBeVisible()
    await quickAdd.fill(TASK_TITLE)
    await quickAdd.press('Enter')
    await expect(quickAdd).toHaveValue('')

    // The redesigned board exposes each column as a labelled region landmark
    // — anchor on that instead of the composer textbox's parent, whose DOM
    // position (inside its own form) stopped containing the task list.
    const todoColumn = page.getByRole('region', { name: 'To do' })
    const inProgressColumn = page.getByRole('region', { name: 'In progress' })
    // Drag from the card's dedicated reorder handle — the stable, purpose-built
    // affordance — rather than the title text's parent, which detaches when the
    // board re-renders as the optimistic create settles (boundingBox → null).
    const handle = todoColumn.getByRole('button', { name: `Reorder ${TASK_TITLE}` })
    await expect(handle).toBeVisible()

    const dropTarget = inProgressColumn.getByText('Nothing here yet', { exact: false })
    await expect(dropTarget).toBeVisible()
    // Let the post-create refresh finish so the handle we grab is the settled
    // element, not the optimistic one about to be swapped out.
    await page.waitForLoadState('networkidle')
    await dragTaskTo(page, handle, dropTarget)

    await expect(inProgressColumn.getByText(TASK_TITLE, { exact: true })).toBeVisible()
    await expect(todoColumn.getByText(TASK_TITLE, { exact: true })).toHaveCount(0)

    // The real assertion: the move persisted server-side, not just optimistically.
    await page.reload()
    await expect(
      page.getByRole('region', { name: 'In progress' }).getByText(TASK_TITLE, { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'To do' }).getByText(TASK_TITLE, { exact: true }),
    ).toHaveCount(0)
  })

  test('create a meeting; missing calendar grant warns but still saves', async ({ page }) => {
    await page.goto('/meetings')
    await page.getByRole('button', { name: 'New meeting' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'New meeting' })).toBeVisible()
    await dialog.getByLabel('Title').fill(MEETING_TITLE)
    // Starts/Ends arrive pre-filled with the next sensible slot in the
    // redesigned form (the old "Pick a date" popover is gone), and this
    // test's subject — the missing-calendar-grant warning — doesn't depend
    // on WHICH times the meeting has. Defaults are the realistic path.

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

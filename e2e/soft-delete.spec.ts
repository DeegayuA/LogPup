// End-to-end coverage for the soft-deletes feature: delete/restore/purge for
// meetings and tasks, driven through the admin Trash card. Follows
// smoke.spec.ts's conventions exactly — serial mode, a single RUN_ID tag on
// every row this suite creates, cleanup via the direct `{ db }` import in
// afterAll, and the single dev-login admin session (storageState from
// e2e/auth.setup.ts) for every step. There is no second-user login harness in
// this repo, so "the deleter's name" is always the dev-login admin's.
import './env'
import { eq, inArray } from 'drizzle-orm'
import { test, expect, type Locator, type Page } from '@playwright/test'
import { db } from '@/db'
import { apps, meetings, tasks } from '@/db/schema'
import { slugify } from '@/lib/slug'

test.describe.configure({ mode: 'serial' })

const RUN_ID = Date.now()
const APP_NAME = `E2E SD App ${RUN_ID}`
const APP_SLUG = slugify(APP_NAME)
const SPRINT_NAME = `E2E SD Sprint ${RUN_ID}`
const TASK_TITLE = `E2E SD task ${RUN_ID}`

const MEETING_RESTORE = `E2E SD meeting restore ${RUN_ID}`
const MEETING_DOUBLE = `E2E SD meeting double ${RUN_ID}`
const MEETING_PURGE = `E2E SD meeting purge ${RUN_ID}`
const MEETING_GATE = `E2E SD meeting gate ${RUN_ID}`
const ALL_MEETING_TITLES = [MEETING_RESTORE, MEETING_DOUBLE, MEETING_PURGE, MEETING_GATE]

/** dev-login's display name (seedDevUser: `email.split('@')[0]`) — same
 *  literal smoke.spec.ts already relies on for the attendee-picker option. */
const DEV_USER_NAME = 'deeghayus'

function todayISODate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** yyyy-MM-ddTHH:mm for today at the given hour/minute — the format
 *  DateTimeWheelField's "Type instead" native `datetime-local` input takes
 *  (src/components/ui/datetime-wheel.tsx). */
function todayAt(hour: number, minute = 0): string {
  return `${todayISODate()}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** Fills one of MeetingForm's two date/time fields by its visible label.
 *  MeetingForm renders each field as a `DateTimeWheelField`
 *  (src/components/ui/datetime-wheel.tsx): a Label + a per-field "Type
 *  instead" toggle share one row, and toggling swaps the wheel-picker popover
 *  button below it for a plain `<input type="datetime-local">` carrying the
 *  same label — the native input is far less brittle to drive here than
 *  scroll-snap wheel columns. */
async function fillMeetingDateTime(page: Page, dialog: Locator, label: 'Starts' | 'Ends', value: string) {
  const row = dialog.getByText(label, { exact: true }).locator('xpath=..')
  await row.getByRole('button', { name: 'Type instead' }).click()
  await dialog.getByLabel(label, { exact: true }).fill(value)
}

/** past-meetings-section.tsx starts collapsed on every hard navigation — a
 *  meeting whose startsAt has already ticked into the past (split-upcoming.ts
 *  compares against `now`, not endsAt) renders under a "Show past meetings"
 *  toggle rather than being visible outright. Expanding unconditionally
 *  before locating a meeting keeps every assertion below correct regardless
 *  of what time of day this suite happens to run. */
async function expandPastMeetingsIfCollapsed(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: 'Show past meetings' })
  if ((await toggle.count()) > 0) await toggle.click()
}

/** Creates a meeting (title + today 10:00-11:00 + the dev-login user as
 *  attendee, the one non-empty attendee list createMeetingInput requires)
 *  and waits for it to land on /meetings. */
async function createMeeting(page: Page, title: string): Promise<void> {
  await page.goto('/meetings')
  await page.getByRole('button', { name: 'New meeting' }).click()

  // Named, not bare getByRole('dialog'): the attendee popover below is also
  // role="dialog" and — mid its own 100ms close-animation — can still be in
  // the DOM (data-closed, not yet unmounted) at the moment "Create meeting"
  // is clicked, which would make an unscoped dialog locator ambiguous.
  const dialog = page.getByRole('dialog', { name: 'New meeting' })
  await expect(dialog.getByRole('heading', { name: 'New meeting' })).toBeVisible()
  await dialog.getByLabel('Title').fill(title)
  await fillMeetingDateTime(page, dialog, 'Starts', todayAt(10, 0))
  await fillMeetingDateTime(page, dialog, 'Ends', todayAt(11, 0))

  await dialog.getByRole('button', { name: 'Add attendee' }).click()
  await page.getByRole('option', { name: DEV_USER_NAME }).click()
  await expect(dialog.getByText(DEV_USER_NAME)).toBeVisible()

  await dialog.getByRole('button', { name: 'Create meeting' }).click()
  await expect(dialog).not.toBeVisible()

  await expandPastMeetingsIfCollapsed(page)
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
}

/** Deletes a meeting from the /meetings list (the row-level trash-can icon +
 *  its confirm AlertDialog), assuming `page` is already on /meetings. */
async function deleteMeetingViaList(page: Page, title: string): Promise<void> {
  await expandPastMeetingsIfCollapsed(page)
  const article = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
  await article.getByRole('button', { name: 'Delete meeting' }).click()

  const confirmDialog = page.getByRole('alertdialog')
  await expect(confirmDialog.getByRole('heading', { name: 'Delete meeting?' })).toBeVisible()
  await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText('Meeting deleted')).toBeVisible()
}

/** One row of the admin Trash card — `<li>` inside the group's `<ul>`,
 *  scoped by its (RUN_ID-unique) label text. */
function trashRow(page: Page, label: string): Locator {
  return page.getByRole('listitem').filter({ hasText: label })
}

test.describe('LogPup soft-delete e2e', () => {
  test.afterAll(async () => {
    // apps.id cascades to assignments/sprints/tasks (see src/db/schema.ts),
    // same as smoke.spec.ts's cleanup. Meetings have no app link here
    // ("No app" for every meeting this suite creates) and are cleaned up by
    // title; MEETING_PURGE is already gone from the DB by the time this
    // runs (that's what its test asserts), so its entry here is a no-op.
    await db.delete(apps).where(eq(apps.slug, APP_SLUG))
    await db.delete(meetings).where(inArray(meetings.title, ALL_MEETING_TITLES))
  })

  test('meeting: delete removes it from /meetings; Trash shows the deleter; restore brings it back (DB deletedAt null)', async ({
    page,
  }) => {
    await createMeeting(page, MEETING_RESTORE)
    await deleteMeetingViaList(page, MEETING_RESTORE)

    // Gone from /meetings — checked with the past section forced open, so a
    // still-present-but-collapsed row can't masquerade as "deleted".
    await expandPastMeetingsIfCollapsed(page)
    await expect(page.getByRole('heading', { name: MEETING_RESTORE, exact: true })).toHaveCount(0)

    // Shows up in the admin Trash card, naming the dev-login admin as the
    // deleter.
    await page.goto('/admin')
    const row = trashRow(page, MEETING_RESTORE)
    await expect(row).toBeVisible()
    await expect(row.getByText(DEV_USER_NAME)).toBeVisible()

    // Restore.
    await row.getByRole('button', { name: 'Restore' }).click()
    await expect(page.getByText('Restored')).toBeVisible()
    await expect(trashRow(page, MEETING_RESTORE)).toHaveCount(0)

    // Back on /meetings.
    await page.goto('/meetings')
    await expandPastMeetingsIfCollapsed(page)
    await expect(page.getByRole('heading', { name: MEETING_RESTORE, exact: true })).toBeVisible()

    // DB assertion: deletedAt is really cleared, not just hidden by the UI.
    const [dbRow] = await db
      .select({ deletedAt: meetings.deletedAt, deletedBy: meetings.deletedBy })
      .from(meetings)
      .where(eq(meetings.title, MEETING_RESTORE))
    expect(dbRow?.deletedAt).toBeNull()
    expect(dbRow?.deletedBy).toBeNull()
  })

  test('task: delete removes it from the board; restore returns it', async ({ page }) => {
    // Setup: a fresh app + sprint, same shape as smoke.spec.ts's board flow.
    await page.goto('/apps')
    await page.getByRole('button', { name: 'New app' }).click()
    const appDialog = page.getByRole('dialog')
    await expect(appDialog.getByRole('heading', { name: 'New app' })).toBeVisible()
    await appDialog.getByLabel('Name').fill(APP_NAME)
    await appDialog.getByRole('button', { name: 'Create app' }).click()
    await expect(page.getByText('App created')).toBeVisible()
    await expect(appDialog).not.toBeVisible()

    await page.goto(`/apps/${APP_SLUG}?tab=board`)
    await page.getByRole('button', { name: 'New sprint' }).first().click()
    const sprintDialog = page.getByRole('dialog')
    await expect(sprintDialog.getByRole('heading', { name: 'New sprint' })).toBeVisible()
    await sprintDialog.getByLabel('Name').fill(SPRINT_NAME)
    const start = todayISODate()
    await sprintDialog.getByLabel('Start date').fill(start)
    await sprintDialog.getByLabel('End date').fill(start)
    await sprintDialog.getByRole('button', { name: 'Create sprint' }).click()
    await expect(page.getByText('Sprint created')).toBeVisible()

    const quickAdd = page.getByLabel('Add task to To do')
    await expect(quickAdd).toBeVisible()
    await quickAdd.fill(TASK_TITLE)
    await quickAdd.press('Enter')
    await expect(quickAdd).toHaveValue('')

    // BoardColumn (src/features/sprints/components/board-column.tsx) is a
    // <section aria-labelledby> — an accessible-name'd section is an ARIA
    // "region" — so this scopes to the whole "To do" column (heading, task
    // list and composer together) regardless of how the DOM nests inside it.
    const todoColumn = page.getByRole('region', { name: 'To do' })
    const taskCard = todoColumn.getByText(TASK_TITLE, { exact: true })
    await expect(taskCard).toBeVisible()

    // Open the task and delete it (admin-only Delete button inside TaskDialog).
    await taskCard.click()
    const taskDialog = page.getByRole('dialog')
    await expect(taskDialog.getByRole('heading', { name: 'Edit task' })).toBeVisible()
    await taskDialog.getByRole('button', { name: 'Delete', exact: true }).click()

    const confirmDialog = page.getByRole('alertdialog')
    await expect(confirmDialog.getByRole('heading', { name: 'Delete this task?' })).toBeVisible()
    await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByText('Task deleted')).toBeVisible()

    // Gone from the board.
    await expect(page.getByText(TASK_TITLE, { exact: true })).toHaveCount(0)

    // Restore from the admin Trash card.
    await page.goto('/admin')
    const row = trashRow(page, TASK_TITLE)
    await expect(row).toBeVisible()
    await expect(row.getByText(DEV_USER_NAME)).toBeVisible()
    await row.getByRole('button', { name: 'Restore' }).click()
    await expect(page.getByText('Restored')).toBeVisible()
    await expect(trashRow(page, TASK_TITLE)).toHaveCount(0)

    // Back on the board.
    await page.goto(`/apps/${APP_SLUG}?tab=board`)
    await expect(
      page.getByRole('region', { name: 'To do' }).getByText(TASK_TITLE, { exact: true }),
    ).toBeVisible()

    const [dbTask] = await db
      .select({ deletedAt: tasks.deletedAt })
      .from(tasks)
      .where(eq(tasks.title, TASK_TITLE))
    expect(dbTask?.deletedAt).toBeNull()
  })

  test('purge: deleting a meeting forever removes the row from the DB', async ({ page }) => {
    await createMeeting(page, MEETING_PURGE)
    await deleteMeetingViaList(page, MEETING_PURGE)

    await page.goto('/admin')
    const row = trashRow(page, MEETING_PURGE)
    await expect(row).toBeVisible()

    await row.getByRole('button', { name: 'Delete forever' }).click()
    const dialog = page.getByRole('dialog', { name: 'Delete forever?' })
    await expect(dialog.getByRole('heading', { name: 'Delete forever?' })).toBeVisible()

    const confirmButton = dialog.getByRole('button', { name: 'Delete forever', exact: true })
    const input = dialog.getByRole('textbox')

    // The gate: a wrong phrase leaves the button disabled.
    await expect(confirmButton).toBeDisabled()
    await input.fill('delete forevr')
    await expect(confirmButton).toBeDisabled()

    // The exact phrase enables it.
    await input.fill('delete forever')
    await expect(confirmButton).toBeEnabled()

    await confirmButton.click()
    await expect(page.getByText('Deleted forever')).toBeVisible()
    await expect(trashRow(page, MEETING_PURGE)).toHaveCount(0)

    // DB assertion: the row is really gone, not just hidden.
    const rows = await db.select({ id: meetings.id }).from(meetings).where(eq(meetings.title, MEETING_PURGE))
    expect(rows).toHaveLength(0)
  })

  test('double-restore: restoring an already-restored meeting surfaces the inline error, no crash', async ({
    page,
    context,
  }) => {
    await createMeeting(page, MEETING_DOUBLE)
    await deleteMeetingViaList(page, MEETING_DOUBLE)

    // Two tabs on /admin, both server-rendered while the meeting is still
    // trashed — this reproduces a genuine restore-race (tab B's Restore
    // button is still live after tab A has already restored the row) rather
    // than a synthetic double-click, which React's pending-disabled state
    // would swallow before a second request ever reached the server.
    await page.goto('/admin')
    const rowA = trashRow(page, MEETING_DOUBLE)
    await expect(rowA).toBeVisible()

    const page2 = await context.newPage()
    await page2.goto('/admin')
    const rowB = trashRow(page2, MEETING_DOUBLE)
    await expect(rowB).toBeVisible()

    // Tab A restores successfully and its view refreshes.
    await rowA.getByRole('button', { name: 'Restore' }).click()
    await expect(page.getByText('Restored')).toBeVisible()
    await expect(trashRow(page, MEETING_DOUBLE)).toHaveCount(0)

    // Tab B never refreshed — its Restore button is still there. Clicking it
    // now hits restoreMeeting's `isNotNull(deletedAt)` guard server-side and
    // must surface the inline error, not crash the page.
    await rowB.getByRole('button', { name: 'Restore' }).click()
    await expect(page2.getByText('Not found, or it was already restored')).toBeVisible()
    // The page is still alive and interactive — not a crashed/error boundary.
    await expect(page2.getByRole('heading', { name: 'Admin' })).toBeVisible()
    await expect(rowB).toBeVisible()

    await page2.close()
  })

  test('typed-confirm gate: "Delete forever" stays disabled until exactly "delete forever" is typed', async ({
    page,
  }) => {
    await createMeeting(page, MEETING_GATE)
    await deleteMeetingViaList(page, MEETING_GATE)

    await page.goto('/admin')
    const row = trashRow(page, MEETING_GATE)
    await row.getByRole('button', { name: 'Delete forever' }).click()

    const dialog = page.getByRole('dialog', { name: 'Delete forever?' })
    const confirmButton = dialog.getByRole('button', { name: 'Delete forever', exact: true })
    const input = dialog.getByRole('textbox')

    await expect(confirmButton).toBeDisabled()

    await input.fill('Delete Forever') // wrong case
    await expect(confirmButton).toBeDisabled()

    await input.fill('delete forev') // partial
    await expect(confirmButton).toBeDisabled()

    await input.fill('delete forever ') // trailing space
    await expect(confirmButton).toBeDisabled()

    await input.fill('delete forever') // exact
    await expect(confirmButton).toBeEnabled()

    await input.fill('delete forever!') // exact-plus-more, back to disabled
    await expect(confirmButton).toBeDisabled()

    // Close without confirming — this row is left trashed on purpose (proves
    // nothing was purged) and is swept up in afterAll by title.
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(trashRow(page, MEETING_GATE)).toBeVisible()
  })
})

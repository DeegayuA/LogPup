'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { InboxIcon, RotateCcwIcon, Trash2Icon } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import {
  headerSelectionState,
  pruneSelection,
  selectRange,
  summarizeOutcomes,
  toggleAllSelected,
  toggleSelected,
  type BulkOutcome,
} from '@/features/admin/bulk-logic'
import { BulkBar, toastBulkResult } from '@/features/admin/components/bulk-bar'
import { HeaderCheckbox, RowCheckbox } from '@/features/admin/components/bulk-select'
import type { TrashGroup, TrashKind, TrashRow } from '@/features/admin/trash-grouping'
import {
  matchesPurgeConfirm,
  orderGroupsForDisplay,
  PURGE_CONFIRM_PHRASE,
  restoreDisabledReason,
  trashCountFootnote,
  TRASH_GROUP_TITLES,
} from './trash-card-logic'
import { callRestore, PURGE_BY_KIND, TrashRowActions } from './trash-row-actions'

const ITEMS = { one: 'item', many: 'items' }

/** Selection keys carry the kind — row ids are only unique within a table. */
const rowKey = (kind: TrashKind, id: string) => `${kind}:${id}`

/**
 * One trashed row. The label already carries everything a segment/keyframe
 * needs to read as nested under its meeting ("a note segment in Standup") —
 * trash-grouping.ts bakes that in (see its file header on the neutral-label
 * rule), so this stays a flat row rather than a second layout for those two
 * kinds. Never renders segment/keyframe CONTENT — only what trash-grouping.ts
 * already reduced the row to.
 */
function TrashRowItem({
  kind,
  row,
  checked,
  onToggle,
}: {
  kind: TrashKind
  row: TrashRow
  checked: boolean
  onToggle: (range: boolean) => void
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <RowCheckbox checked={checked} label={`Select ${row.label}`} onToggle={onToggle} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium">{row.label}</span>
          {row.context ? (
            <span className="truncate text-xs text-muted-foreground">{row.context}</span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Avatar size="sm">
            {row.deletedByAvatarUrl ? <AvatarImage src={row.deletedByAvatarUrl} alt="" /> : null}
            <AvatarFallback>{(row.deletedByName ?? '?').slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span>{row.deletedByName ?? 'Unknown'}</span>
        </div>
        {/* suppressHydrationWarning: "3 minutes ago" can tick over between the
            server render and hydration now that this card is a client
            component; the drift is a second, not a fact. */}
        <time
          dateTime={row.deletedAt.toISOString()}
          className="font-mono tabular-nums"
          title={format(row.deletedAt, "MMM d, yyyy 'at' HH:mm")}
          suppressHydrationWarning
        >
          {formatDistanceToNowStrict(row.deletedAt, { addSuffix: true })}
        </time>
      </div>

      <TrashRowActions kind={kind} id={row.id} parentTrashed={row.parentTrashed} />
    </li>
  )
}

function TrashGroupSection({
  group,
  selectedSet,
  onToggle,
}: {
  group: TrashGroup
  selectedSet: Set<string>
  onToggle: (key: string, range: boolean) => void
}) {
  if (group.rows.length === 0) return null
  const footnote = trashCountFootnote(group.rows.length, group.totalCount)

  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {TRASH_GROUP_TITLES[group.kind]}
        <Badge variant="secondary">{group.rows.length}</Badge>
      </h3>
      <ul className="flex flex-col gap-2">
        {group.rows.map((row) => {
          const key = rowKey(group.kind, row.id)
          return (
            <TrashRowItem
              key={row.id}
              kind={group.kind}
              row={row}
              checked={selectedSet.has(key)}
              onToggle={(range) => onToggle(key, range)}
            />
          )
        })}
      </ul>
      {footnote ? <p className="text-xs text-muted-foreground">{footnote}</p> : null}
    </section>
  )
}

/**
 * The admin Trash card — fed by getTrash() from the page (never fetched
 * separately, per the admin page's existing bounded-data-loading pattern).
 * Groups render in TRASH_GROUP_ORDER; each row's Restore/"Delete forever"
 * controls live in TrashRowActions.
 *
 * BULK SELECTION, client-side fan-out. Restoring a project deleted with 20
 * tasks used to be 20+ dialogs; now it is tick, tick, Restore. The batch
 * calls the SAME per-row server actions the row buttons call — every
 * capability check and parent-trashed guard still runs per row on the server
 * — and reports what it skipped through the shared bulk toast, like the
 * People and Apps tables. Purging keeps the typed-phrase discipline: one
 * phrase, checked again server-side on every row; people and assignments
 * have no purge by design (see PURGE_BY_KIND's docblock) and are reported
 * as skipped rather than silently dropped.
 */
export function TrashCard({ groups }: { groups: TrashGroup[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [picked, setPicked] = useState<string[]>([])
  const [anchorKey, setAnchorKey] = useState<string | null>(null)
  const [purgeOpen, setPurgeOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const ordered = useMemo(() => orderGroupsForDisplay(groups), [groups])
  const isEmpty = ordered.every((group) => group.rows.length === 0)

  // Display order across every group, so shift-range spans group borders the
  // way the eye reads the page.
  const rowsByKey = useMemo(() => {
    const map = new Map<string, { kind: TrashKind; row: TrashRow }>()
    for (const group of ordered) {
      for (const row of group.rows) map.set(rowKey(group.kind, row.id), { kind: group.kind, row })
    }
    return map
  }, [ordered])
  const allKeys = useMemo(() => [...rowsByKey.keys()], [rowsByKey])

  const selected = useMemo(() => pruneSelection(picked, allKeys), [picked, allKeys])
  const selectedSet = useMemo(() => new Set(selected), [selected])

  function toggleRow(key: string, range: boolean) {
    setPicked((current) =>
      range && anchorKey
        ? selectRange(pruneSelection(current, allKeys), allKeys, anchorKey, key)
        : toggleSelected(pruneSelection(current, allKeys), key),
    )
    setAnchorKey(key)
  }

  function runBulkRestore() {
    startTransition(async () => {
      const outcomes: BulkOutcome[] = []
      for (const key of allKeys) {
        if (!selectedSet.has(key)) continue
        const entry = rowsByKey.get(key)
        if (!entry) continue
        const blocked = restoreDisabledReason(entry.row)
        if (blocked) {
          outcomes.push({ id: key, ok: false, reason: blocked })
          continue
        }
        try {
          const res = await callRestore(entry.kind, entry.row.id)
          outcomes.push(res.ok ? { id: key, ok: true } : { id: key, ok: false, reason: res.error })
        } catch {
          outcomes.push({ id: key, ok: false, reason: 'something went wrong' })
        }
      }
      toastBulkResult(summarizeOutcomes(outcomes), 'restored', ITEMS)
      // Left selected on purpose (same as People/Apps): the refused rows are
      // the ones worth still having in hand after the toast.
      router.refresh()
    })
  }

  function runBulkPurge() {
    startTransition(async () => {
      const outcomes: BulkOutcome[] = []
      for (const key of allKeys) {
        if (!selectedSet.has(key)) continue
        const entry = rowsByKey.get(key)
        if (!entry) continue
        const purge = PURGE_BY_KIND[entry.kind]
        if (!purge) {
          outcomes.push({ id: key, ok: false, reason: 'cannot be purged, only restored' })
          continue
        }
        try {
          // The typed phrase goes through verbatim; every row's action
          // re-checks it server-side.
          const res = await purge(entry.row.id, confirmText)
          outcomes.push(res.ok ? { id: key, ok: true } : { id: key, ok: false, reason: res.error })
        } catch {
          outcomes.push({ id: key, ok: false, reason: 'something went wrong' })
        }
      }
      toastBulkResult(summarizeOutcomes(outcomes), 'deleted forever', ITEMS)
      setPurgeOpen(false)
      setConfirmText('')
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Trash</CardTitle>
        <CardDescription>
          Soft-deleted items, most recent first. Restore brings something back exactly as
          it was; &quot;Delete forever&quot; removes it — and its stored files — for good.
          Tick rows to restore or purge several at once.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <BulkBar count={selected.length} noun={ITEMS} onClear={() => setPicked([])}>
          <Button variant="outline" size="sm" disabled={isPending} onClick={runBulkRestore}>
            <RotateCcwIcon aria-hidden className="size-3.5" />
            Restore
          </Button>

          <Dialog
            open={purgeOpen}
            onOpenChange={(open) => {
              setPurgeOpen(open)
              if (!open) setConfirmText('')
            }}
          >
            <DialogTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  className="border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10"
                />
              }
            >
              <Trash2Icon aria-hidden className="size-3.5" />
              Delete forever
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete {selected.length} {selected.length === 1 ? 'item' : 'items'} forever?</DialogTitle>
                <DialogDescription>
                  This permanently removes the data and its stored files. There is no
                  undo. People and assignments in the selection are skipped — they can
                  only be restored. Type{' '}
                  <span className="font-mono font-medium text-foreground">
                    {PURGE_CONFIRM_PHRASE}
                  </span>{' '}
                  to confirm.
                </DialogDescription>
              </DialogHeader>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={PURGE_CONFIRM_PHRASE}
                aria-label={`Type "${PURGE_CONFIRM_PHRASE}" to confirm`}
                autoComplete="off"
                autoFocus
                // The confirm is an exact, case-sensitive string match. iOS
                // Safari capitalises the first letter of a text field by
                // default and both mobile keyboards autocorrect — either one
                // turns "delete forever" into something that never matches.
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="font-mono"
              />
              <DialogFooter>
                <Button
                  variant="destructive"
                  type="button"
                  disabled={!matchesPurgeConfirm(confirmText) || isPending}
                  onClick={runBulkPurge}
                >
                  {isPending ? 'Deleting…' : 'Delete forever'}
                </Button>
              </DialogFooter>
              {/* The reason the button is disabled, visible rather than a
                  title attribute. */}
              {!matchesPurgeConfirm(confirmText) ? (
                <p className="text-2xs text-muted-foreground">
                  Type &quot;{PURGE_CONFIRM_PHRASE}&quot; above to enable the button.
                </p>
              ) : null}
            </DialogContent>
          </Dialog>
        </BulkBar>

        {isEmpty ? (
          <EmptyState
            icon={InboxIcon}
            title="Nothing in the trash."
            description="Deleted apps, meetings, tasks, sprints and removed people land here, restorable exactly as they were."
            className="rounded-xl border border-dashed border-border"
          />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <HeaderCheckbox
                state={headerSelectionState(selected, allKeys)}
                label="Select everything in the trash"
                onToggle={() =>
                  setPicked((current) =>
                    toggleAllSelected(pruneSelection(current, allKeys), allKeys),
                  )
                }
              />
              <span className="text-xs text-muted-foreground">Select all shown</span>
            </div>
            {ordered.map((group) => (
              <TrashGroupSection
                key={group.kind}
                group={group}
                selectedSet={selectedSet}
                onToggle={toggleRow}
              />
            ))}
          </>
        )}

        <p className="text-xs text-muted-foreground">
          Deactivated users and archived apps aren&apos;t listed here — those are live
          lifecycle states, not deletions, and stay under the Users and Apps cards above.
        </p>
      </CardContent>
    </Card>
  )
}

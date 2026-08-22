'use client'

import { useRef, useState, useTransition, type ChangeEvent, type ReactElement } from 'react'
import { toast } from 'sonner'
import { Download, FileUp, Loader2, TriangleAlert, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { downloadCsv } from '@/features/admin/components/csv-download'
import {
  bugSeverityBadgeVariant,
  bugSeverityLabel,
  bugStatusBadgeVariant,
  bugStatusLabel,
} from '@/features/bugs/bug-display'
import {
  BUG_CSV_COLUMNS,
  BUG_CSV_EXAMPLE_ROW,
  BUG_CSV_HEADERS,
  BUG_CSV_MAX_CHARS,
  BUG_CSV_ROW_LIMIT,
  BUG_CSV_TEMPLATE_PREFIX,
} from '@/features/bugs/bug-csv'
import {
  importBugCsvRows,
  previewBugCsvImport,
  type BugImportPreview,
} from '@/features/bugs/import-actions'

/**
 * Bulk bug import — the whole of it, in one dialog.
 *
 * THREE THINGS IT REFUSES TO DO, each because the alternative loses somebody's
 * work or changes their meaning:
 *
 * 1. IT NEVER IMPORTS WITHOUT SHOWING THE PREVIEW FIRST. The file is parsed on
 *    the server and comes back as "these N will be created, these M will be
 *    skipped and here is why" — and nothing is written until the button in the
 *    footer is pressed. A bulk write is the one mistake that cannot be undone
 *    row by row afterwards.
 *
 * 2. IT NEVER DROPS A ROW SILENTLY. Every skipped row is listed with its file
 *    row number and every reason it was skipped. A count of failures with no
 *    names is a count nobody can act on, and a row that vanishes is a bug that
 *    never got filed and nobody knows it.
 *
 * 3. IT NEVER CLEARS ITSELF ON DISMISS. Esc and a mis-clicked backdrop leave
 *    the chosen file and its preview exactly where they were, so reopening
 *    resumes rather than restarts. (report-bug-dialog.tsx resets on every open
 *    transition — that is a known defect, not a pattern to copy: somebody who
 *    has just prepared a fifty-row import and fumbles a click must not have to
 *    do it again.) State is cleared in exactly one place: after an import has
 *    actually succeeded, when keeping it would mean offering to import the
 *    same file twice.
 *
 * The template download is CLIENT-SIDE — a Blob built from the pure module's
 * own column list, through the same `downloadCsv` the admin exports use. No
 * endpoint, no round trip, and no anchor pointing at a URL a sandbox can
 * refuse to follow.
 */

export function BugCsvImportDialog({
  appId,
  appName,
  canImport,
  trigger,
}: {
  appId: string
  appName: string
  /**
   * Whether this viewer holds `bug.triage` on this project — the same gate the
   * Bugs tab uses for the triage controls. Rendering nothing is a decluttering
   * decision, NOT the enforcement: both server actions re-ask the capability,
   * scoped to the app, on every call.
   */
  canImport: boolean
  /** Lets the caller restyle the button so it pairs with Report a bug. */
  trigger?: ReactElement
}) {
  const [open, setOpen] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [csv, setCsv] = useState('')
  const [preview, setPreview] = useState<BugImportPreview | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [reading, startReading] = useTransition()
  const [importing, startImporting] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const busy = reading || importing

  /** Only ever called after a successful import. See point 3 in the header. */
  function clearChosenFile() {
    setFileName(null)
    setCsv('')
    setPreview(null)
    setFileError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleTemplateDownload() {
    // Same headers and same example row the parser is tested against, so the
    // file a PM opens is the file the importer expects back.
    downloadCsv(BUG_CSV_TEMPLATE_PREFIX, BUG_CSV_HEADERS, [BUG_CSV_EXAMPLE_ROW])
  }

  function handleFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Clearing the input's value is what lets the SAME file be chosen again
    // after a fix — without it the change event never fires a second time and
    // the dialog looks frozen.
    event.target.value = ''
    if (!file) return

    setFileError(null)
    setPreview(null)
    setFileName(file.name)

    startReading(async () => {
      let text: string
      try {
        text = await file.text()
      } catch {
        setFileError('That file could not be read — try saving it again as CSV')
        return
      }

      // Checked here as well as on the server: past the body limit the platform
      // rejects the call before any of our code runs, and the person is left
      // with a failure that explains nothing.
      if (text.length > BUG_CSV_MAX_CHARS) {
        setFileError(
          `That file is too large to import in one go — ${BUG_CSV_ROW_LIMIT} rows is the most one import can take`,
        )
        return
      }

      setCsv(text)
      try {
        const res = await previewBugCsvImport({ appId, csv: text })
        if (!res.ok) {
          setFileError(res.error)
          return
        }
        setPreview(res.data)
      } catch {
        // A server action can REJECT as well as resolve with `{ ok: false }`.
        // Unhandled, the dialog sits on a spinner that never stops.
        setFileError('Something went wrong reading that file — try again')
      }
    })
  }

  function handleImport() {
    if (!preview || preview.valid.length === 0) return
    startImporting(async () => {
      try {
        const res = await importBugCsvRows({ appId, csv })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(res.data.summary, { description: appName })
        clearChosenFile()
        setOpen(false)
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  if (!canImport) return null

  const validCount = preview?.valid.length ?? 0
  const invalidCount = preview?.invalid.length ?? 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button variant="outline" size="sm" />}>
        <Upload aria-hidden />
        Import CSV
      </DialogTrigger>
      {/* Wider than the default sm: the preview is a table, and a table that
          has to scroll sideways to show a title is a table nobody checks. */}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import bugs from a CSV</DialogTitle>
          <DialogDescription>
            A faster way to file the same bugs, into{' '}
            <span className="font-medium text-foreground">{appName}</span>. Nothing is
            created until you have seen what will be.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <TemplateSection onDownload={handleTemplateDownload} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="bug-csv-file">Your filled-in file</Label>
            <Input
              id="bug-csv-file"
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={handleFileChosen}
              aria-describedby="bug-csv-file-hint"
            />
            <p id="bug-csv-file-hint" className="text-2xs text-muted-foreground">
              Up to {BUG_CSV_ROW_LIMIT} rows. The project and the reporter come from here,
              not from the file — every bug lands in {appName}, filed by you.
            </p>
          </div>

          {reading ? (
            <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2
                aria-hidden
                className="size-3.5 animate-spin motion-reduce:animate-none"
              />
              Reading {fileName ?? 'your file'}…
            </p>
          ) : null}

          {fileError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
            >
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div className="flex flex-col gap-1">
                <p className="font-medium">That file could not be imported</p>
                <p className="text-muted-foreground">{fileError}</p>
              </div>
            </div>
          ) : null}

          {preview && !reading ? (
            <ImportPreview preview={preview} fileName={fileName} />
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={importing} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy || validCount === 0} onClick={handleImport}>
            {importing ? (
              <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <FileUp aria-hidden />
            )}
            {importing
              ? 'Importing…'
              : validCount === 0
                ? 'Import'
                : `Import ${validCount} ${validCount === 1 ? 'bug' : 'bugs'}`}
            {invalidCount > 0 && !importing ? (
              <span className="font-mono tabular-nums opacity-70">({invalidCount} skipped)</span>
            ) : null}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * What the file has to look like, and a button that produces one.
 *
 * The column list is generated from BUG_CSV_COLUMNS rather than typed out, so
 * a column added to the format cannot go undocumented here.
 */
function TemplateSection({ onDownload }: { onDownload: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Start from the template</p>
        <Button type="button" variant="outline" size="sm" onClick={onDownload}>
          <Download aria-hidden />
          Download template
        </Button>
      </div>
      <p className="text-2xs text-muted-foreground">
        It carries every column and one example row to delete. Columns are matched by
        name, so you can reorder them or drop the optional ones entirely.
      </p>
      <dl className="flex flex-col gap-1 pt-1">
        {BUG_CSV_COLUMNS.map((column) => (
          <div key={column.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <dt className="font-mono text-2xs text-foreground">{column.header}</dt>
            <dd className="text-2xs text-muted-foreground">{column.help}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/**
 * The preview: what will be created, and every row that will not be.
 *
 * The valid list is capped for rendering and SAYS SO. The invalid list never
 * is — those are the rows somebody has to go and fix, and a truncated list of
 * problems is a list that hides the problem you were about to look for.
 */
const PREVIEW_ROW_CAP = 100

function ImportPreview({
  preview,
  fileName,
}: {
  preview: BugImportPreview
  fileName: string | null
}) {
  const { valid, invalid, ignoredColumns, ignoredExampleRows } = preview
  const shown = valid.slice(0, PREVIEW_ROW_CAP)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-sm font-medium">
          <span className="font-mono tabular-nums">{valid.length}</span> ready to import
        </p>
        {invalid.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-mono tabular-nums">{invalid.length}</span> will be skipped
          </p>
        ) : null}
        {fileName ? (
          <p className="text-2xs break-all text-muted-foreground">from {fileName}</p>
        ) : null}
      </div>

      {ignoredColumns.length > 0 ? (
        <p className="text-2xs text-muted-foreground">
          Ignored {ignoredColumns.length === 1 ? 'a column' : 'columns'} this import has no
          field for: <span className="font-mono">{ignoredColumns.join(', ')}</span>
        </p>
      ) : null}

      {/* Said out loud rather than left to be noticed. The example row is
          visible in the uploader's spreadsheet, so a preview that is silently
          one row shorter reads as the importer having eaten something. */}
      {ignoredExampleRows > 0 ? (
        <p className="text-2xs text-muted-foreground">
          Skipped the template’s own example row
          {ignoredExampleRows === 1 ? '' : ` (${ignoredExampleRows} of them)`} — it was left
          unchanged, so it is not a bug anybody filed.
        </p>
      ) : null}

      {valid.length > 0 ? (
        // TODO(design-system): swap for the shared Table primitive when it
        // lands. Plain markup on purpose rather than a hand-rolled one.
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/40">
              <tr>
                <th scope="col" className="px-2 py-1.5 font-medium">Row</th>
                <th scope="col" className="px-2 py-1.5 font-medium">Title</th>
                <th scope="col" className="px-2 py-1.5 font-medium">Severity</th>
                <th scope="col" className="px-2 py-1.5 font-medium">Status</th>
                <th scope="col" className="px-2 py-1.5 font-medium">Assignee</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.rowNumber} className="border-b last:border-b-0">
                  <td className="px-2 py-1.5 font-mono tabular-nums text-muted-foreground">
                    {row.rowNumber}
                  </td>
                  <td className="px-2 py-1.5">{row.title}</td>
                  <td className="px-2 py-1.5">
                    {row.severity ? (
                      <Badge variant={bugSeverityBadgeVariant(row.severity)}>
                        {bugSeverityLabel(row.severity)}
                      </Badge>
                    ) : (
                      // An empty cell means the column default stands, exactly
                      // as it does for a bug filed from the dialog. Saying
                      // "Medium" here would claim the file chose it.
                      <span className="text-2xs text-muted-foreground">default</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {row.status ? (
                      <Badge variant={bugStatusBadgeVariant(row.status)}>
                        {bugStatusLabel(row.status)}
                      </Badge>
                    ) : (
                      <span className="text-2xs text-muted-foreground">default</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">
                    {row.assigneeName ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {valid.length > shown.length ? (
            <p className="border-t px-2 py-1.5 text-2xs text-muted-foreground">
              Showing the first <span className="font-mono tabular-nums">{shown.length}</span>{' '}
              of <span className="font-mono tabular-nums">{valid.length}</span>. All of them
              will be imported.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No row in this file can be imported as it stands. Fix the rows below and choose the
          file again.
        </p>
      )}

      {invalid.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            Skipped —{' '}
            <span className="font-normal text-muted-foreground">
              nothing here will be created, and nothing else is affected
            </span>
          </p>
          <ul className="flex flex-col gap-1.5">
            {invalid.map((row) => (
              <li
                key={row.rowNumber}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-1.5"
              >
                <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                  Row {row.rowNumber}
                </span>
                {row.title ? (
                  <span className="text-xs font-medium">{row.title}</span>
                ) : (
                  <span className="text-xs text-muted-foreground italic">(no title)</span>
                )}
                <span className="text-2xs text-muted-foreground">
                  {row.reasons.join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

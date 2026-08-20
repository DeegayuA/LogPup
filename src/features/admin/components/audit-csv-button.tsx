'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { downloadCsv } from '@/features/admin/components/csv-download'
import type { CsvValue } from '@/features/admin/bulk-logic'

export const AUDIT_CSV_HEADERS = [
  'Recorded (UTC)',
  'Actor',
  'Action',
  'Entity type',
  'Entity',
  'Detail',
  'App',
  'Self-approved',
  'Entity id',
  'Actor id',
] as const

/**
 * Evidence, exportable. The page's stated purpose is a view a reviewer
 * "pastes into a finding", and until this button the paste was a screenshot
 * or hand-copy — while the sibling People and Apps tables both had CSV.
 *
 * Exports exactly THE ROWS ON THIS PAGE of the filtered view, and says so:
 * the trail is paged in SQL, so the client never holds more than a page, and
 * an export that silently widened past what the reviewer read would be worse
 * than none. The rows arrive pre-flattened from the server component
 * (audit-trail.tsx) — this stays a dumb Blob trigger.
 */
export function AuditCsvButton({ rows, shownOf }: { rows: CsvValue[][]; shownOf: string }) {
  if (rows.length === 0) return null
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => downloadCsv('audit', AUDIT_CSV_HEADERS, rows)}
      title={`Exports ${shownOf} as CSV`}
    >
      <Download aria-hidden className="size-3.5" />
      CSV
      <span className="sr-only"> — exports {shownOf}</span>
    </Button>
  )
}

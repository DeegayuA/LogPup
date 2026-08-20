'use client'

import { csvFilename, toCsv, type CsvValue } from '@/features/admin/bulk-logic'

/**
 * Client-side export. Everything the CSV contains is already rendered on the
 * page, so there is no endpoint and no second read — the download is a Blob
 * built from the rows the admin can already see, which also means it can never
 * hand back a row they were not allowed to look at.
 *
 * The BOM is not decoration: without it Excel reads the file as the local
 * codepage and mangles every non-ASCII name in the workspace.
 */
export function downloadCsv(
  prefix: string,
  headers: readonly string[],
  rows: readonly (readonly CsvValue[])[],
) {
  const blob = new Blob(['﻿', toCsv(headers, rows)], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = csvFilename(prefix, new Date())
  link.click()
  URL.revokeObjectURL(url)
}

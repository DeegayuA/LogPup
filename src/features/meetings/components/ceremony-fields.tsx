'use client'

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { listSprintOptions, type SprintOption } from '@/features/sprints/actions'
import { CEREMONIES, CEREMONY_LABEL, type Ceremony } from '@/features/sprints/scrum'

/**
 * "Is this a Scrum ceremony?" for the meeting form (PRD Module B). A ceremony
 * hangs off a sprint of the meeting's FIRST project — the sprint list is that
 * project's, fetched on demand once a ceremony is chosen. The server checks
 * the sprint belongs to one of the meeting's projects either way.
 */

const NONE = 'none'

export function CeremonyFields({
  appIds,
  ceremony,
  sprintId,
  onChange,
}: {
  appIds: string[]
  ceremony: Ceremony | null
  sprintId: string | null
  onChange: (next: { ceremony: Ceremony | null; sprintId: string | null }) => void
}) {
  const appId = appIds[0] ?? null
  const [sprints, setSprints] = useState<{ appId: string; list: SprintOption[] } | null>(null)

  useEffect(() => {
    if (!ceremony || !appId || sprints?.appId === appId) return
    let alive = true
    listSprintOptions(appId)
      .then((res) => {
        if (alive) setSprints({ appId, list: res.ok ? res.data : [] })
      })
      .catch(() => {
        if (alive) setSprints({ appId, list: [] })
      })
    return () => {
      alive = false
    }
  }, [ceremony, appId, sprints?.appId])

  const list = sprints?.appId === appId ? sprints.list : null

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="meeting-ceremony">Scrum ceremony</Label>
        <Select
          value={ceremony ?? NONE}
          onValueChange={(value) => {
            const next = value === NONE || value === null ? null : (value as Ceremony)
            onChange({ ceremony: next, sprintId: next ? sprintId : null })
          }}
        >
          <SelectTrigger id="meeting-ceremony" className="w-full">
            <SelectValue>{(value: string) => (value === NONE ? 'Not a ceremony' : CEREMONY_LABEL[value as Ceremony])}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Not a ceremony</SelectItem>
            {CEREMONIES.map((c) => (
              <SelectItem key={c} value={c}>
                {CEREMONY_LABEL[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {ceremony ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="meeting-ceremony-sprint">Sprint</Label>
          {!appId ? (
            <p className="text-2xs text-muted-foreground">Add a project above to pick its sprint.</p>
          ) : (
            <Select
              value={sprintId ?? NONE}
              disabled={list === null}
              onValueChange={(value) => onChange({ ceremony, sprintId: value === NONE || value === null ? null : value })}
            >
              <SelectTrigger id="meeting-ceremony-sprint" className="w-full">
                <SelectValue>
                  {(value: string) =>
                    list === null
                      ? 'Loading sprints…'
                      : value === NONE
                        ? 'No sprint'
                        : (list.find((s) => s.id === value)?.name ?? 'Sprint')
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No sprint</SelectItem>
                {(list ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    {s.status === 'active' ? ' (now)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      ) : null}
    </div>
  )
}

'use client'

import * as React from 'react'
import { CheckIcon, ChevronDownIcon, PlusIcon, XIcon } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { selectTriggerClassName } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  type PickablePerson,
  EMPTY_POOL_TEXT,
  LOADING_TEXT,
  NO_MATCH_TEXT,
  UNASSIGNED_VALUE,
  buildPeopleOptions,
  groupPeopleOptions,
  matchesPersonQuery,
  personInitial,
  resolveChipLabels,
  resolveListState,
  resolveTriggerLabel,
  toggleSelection,
} from './meeting-people-picker-model'

/**
 * The one people picker for meeting surfaces — searchable, attendee-first, in
 * single- and multi-select flavours.
 *
 * It replaces four separate Base UI Selects (the action-item row, the
 * "Edit & add" dialog, "Needs attribution", and the "Who's who" speaker
 * picker). Two of those were built from DIFFERENT candidate lists — the row
 * offered the whole workspace, the dialog only attendees — so the same task
 * showed different people depending on which control you opened, and a
 * non-attendee assignee rendered as "Unassigned" in one of them. A single
 * component cannot disagree with itself, which is most of the fix.
 *
 * All ordering, grouping, matching and labelling lives in
 * meeting-people-picker-model.ts so it can be tested — this repo has no jsdom
 * setup, so a component is only as testable as the pure module beside it.
 */

type SharedProps = {
  /** People in this meeting. Offered first, under their own heading. */
  attendees: PickablePerson[]
  /**
   * The wider workspace pool. Offered second and NEVER blocked: the meeting
   * AI routinely names someone who was not in the room, and refusing to offer
   * them makes that task unassignable to the person it names.
   */
  people?: PickablePerson[]
  disabled?: boolean
  loading?: boolean
  /** Accessible name for the trigger. Required — these sit in dense rows. */
  label: string
  size?: 'sm' | 'default'
  className?: string
}

function PersonAvatar({ name }: { name: string | null }) {
  return (
    <Avatar size="sm" className="size-5">
      <AvatarFallback className="text-2xs">{personInitial(name)}</AvatarFallback>
    </Avatar>
  )
}

/**
 * The popup body, shared by both flavours.
 *
 * `selectedValues` drives the check marks rather than a single `value`, so the
 * multi case needs no second implementation of the list.
 */
function PeopleList({
  listId,
  attendees,
  people,
  selectedValues,
  selectedPeople,
  onPick,
  includeUnassigned,
  unassignedLabel,
  loading,
}: {
  /** Referenced by the trigger's aria-controls — see the note at each trigger. */
  listId: string
  attendees: PickablePerson[]
  people?: PickablePerson[]
  selectedValues: string[]
  selectedPeople?: PickablePerson[]
  onPick: (id: string) => void
  includeUnassigned: boolean
  unassignedLabel: string
  loading?: boolean
}) {
  const options = React.useMemo(
    () => buildPeopleOptions({ attendees, people, selected: selectedPeople }),
    [attendees, people, selectedPeople],
  )
  const groups = React.useMemo(() => groupPeopleOptions(options), [options])
  const state = resolveListState({ loading, poolSize: options.length })

  return (
    <Command
      /**
       * cmdk matches on each item's `value`, and ours are user ids — left
       * alone, typing a person's NAME would match nothing, which is the one
       * thing a searchable picker exists to do. Delegated to the model so
       * this and SearchSelect cannot drift into two notions of "matches".
       */
      filter={(itemValue, search) => {
        if (itemValue === UNASSIGNED_VALUE) return search.trim() ? 0 : 1
        const option = options.find((candidate) => candidate.value === itemValue)
        if (!option) return 0
        return matchesPersonQuery(option, search) ? 1 : 0
      }}
    >
      <CommandInput placeholder="Search people…" />
      <CommandList id={listId}>
        {/* Three different facts, three different sentences. An empty popup
            that actually means "still loading" reads as "there is nobody". */}
        {state === 'loading' ? (
          <CommandEmpty>{LOADING_TEXT}</CommandEmpty>
        ) : state === 'empty-pool' ? (
          <CommandEmpty>{EMPTY_POOL_TEXT}</CommandEmpty>
        ) : (
          <CommandEmpty>{NO_MATCH_TEXT}</CommandEmpty>
        )}

        {includeUnassigned ? (
          <CommandGroup>
            <CommandItem value={UNASSIGNED_VALUE} onSelect={() => onPick(UNASSIGNED_VALUE)}>
              <span className="text-muted-foreground">{unassignedLabel}</span>
              <CheckIcon
                aria-hidden
                className={cn(
                  'ml-auto size-4 shrink-0',
                  selectedValues.length === 0 ? 'opacity-100' : 'opacity-0',
                )}
              />
            </CommandItem>
          </CommandGroup>
        ) : null}

        {groups.map((group) => (
          <CommandGroup key={group.group} heading={group.heading}>
            {group.options.map((option) => {
              const picked = selectedValues.includes(option.value)
              return (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  data-checked={picked}
                  onSelect={() => onPick(option.value)}
                >
                  <PersonAvatar name={option.label} />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate">{option.label}</span>
                    {/* The person's own hint only — repeating the section
                        heading under every name inside that section is noise.
                        The heading is still searchable via option.hint. */}
                    {option.detail ? (
                      <span className="truncate text-2xs text-muted-foreground">
                        {option.detail}
                      </span>
                    ) : null}
                  </span>
                  <CheckIcon
                    aria-hidden
                    className={cn('ml-auto size-4 shrink-0', picked ? 'opacity-100' : 'opacity-0')}
                  />
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  )
}

/**
 * One person, or nobody. Drop-in for the Base UI Select this replaces: same
 * `string | null` on both sides, same "Nobody / unassigned" sentinel.
 */
export function MeetingPeoplePicker({
  value,
  onValueChange,
  currentName,
  unassignedLabel = 'Nobody / unassigned',
  attendees,
  people,
  disabled,
  loading,
  label,
  size = 'sm',
  className,
}: SharedProps & {
  value: string | null
  onValueChange: (id: string | null) => void
  /**
   * A name the caller already holds for `value` — used when the pool has not
   * loaded or no longer contains that person, so the trigger still shows a
   * name instead of falling back to "Unassigned" for a task that IS assigned.
   */
  currentName?: string | null
  unassignedLabel?: string
}) {
  const [open, setOpen] = React.useState(false)
  // role="combobox" REQUIRES aria-controls naming its popup, and the popup
  // only exists while open. A stable id referenced by both is what the APG
  // pattern expects — a collapsed combobox may name a listbox that is not
  // currently rendered. Same approach as SearchSelect.
  const listId = React.useId()
  const options = React.useMemo(
    () => buildPeopleOptions({ attendees, people }),
    [attendees, people],
  )
  const triggerLabel = resolveTriggerLabel(value, options, {
    fallbackName: currentName,
    unassignedLabel,
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-haspopup="listbox"
            aria-label={label}
            disabled={disabled}
            data-size={size}
            className={cn(
              selectTriggerClassName,
              'h-auto gap-1.5 border-transparent bg-transparent px-1 py-0.5 hover:border-border hover:bg-muted/50',
              className,
            )}
          />
        }
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <PersonAvatar name={value ? triggerLabel : null} />
          {/* The label is computed, never the raw value — a bare {value} here
              is how a control ends up rendering a uuid at somebody. */}
          <span className="truncate text-xs font-medium">{triggerLabel}</span>
        </span>
        <ChevronDownIcon aria-hidden className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--anchor-width) min-w-64 p-0">
        <PeopleList
          listId={listId}
          attendees={attendees}
          people={people}
          selectedValues={value ? [value] : []}
          onPick={(id) => {
            onValueChange(id === UNASSIGNED_VALUE ? null : id)
            setOpen(false)
          }}
          includeUnassigned
          unassignedLabel={unassignedLabel}
          loading={loading}
        />
      </PopoverContent>
    </Popover>
  )
}

/**
 * Several people. Chips stay in the order they were picked — re-sorting them
 * under someone as they choose is the kind of small betrayal that makes a
 * control feel like it is arguing.
 */
export function MeetingPeopleMultiPicker({
  values,
  onValuesChange,
  fallbackNames,
  addLabel = 'Add person',
  attendees,
  people,
  disabled,
  loading,
  label,
  className,
}: SharedProps & {
  values: string[]
  onValuesChange: (ids: string[]) => void
  /** Names for ids the pool cannot resolve, keyed by id. */
  fallbackNames?: Record<string, string>
  addLabel?: string
}) {
  const [open, setOpen] = React.useState(false)
  // See the note in MeetingPeoplePicker — aria-controls must name the popup.
  const listId = React.useId()
  const options = React.useMemo(
    () => buildPeopleOptions({ attendees, people }),
    [attendees, people],
  )
  const chips = resolveChipLabels(values, options, { fallbackNames })

  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      {chips.map((chip) => (
        <span
          key={chip.value}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 py-0.5 pr-1 pl-0.5 text-xs"
        >
          <PersonAvatar name={chip.label} />
          <span className="max-w-32 truncate font-medium">{chip.label}</span>
          {/* A real button, not a click handler on the chip: removing somebody
              from a task has to be reachable by keyboard. */}
          <button
            type="button"
            disabled={disabled}
            aria-label={`Remove ${chip.label}`}
            onClick={() => onValuesChange(toggleSelection(values, chip.value))}
            className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <XIcon aria-hidden className="size-3" />
          </button>
        </span>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-haspopup="listbox"
              aria-label={label}
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-solid hover:bg-muted/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
          }
        >
          <PlusIcon aria-hidden className="size-3" />
          {chips.length === 0 ? addLabel : <span className="sr-only">{addLabel}</span>}
        </PopoverTrigger>
        <PopoverContent align="start" className="min-w-64 p-0">
          <PeopleList
            listId={listId}
            attendees={attendees}
            people={people}
            selectedValues={values}
            onPick={(id) => onValuesChange(toggleSelection(values, id))}
            includeUnassigned={false}
            unassignedLabel=""
            loading={loading}
          />
        </PopoverContent>
      </Popover>
    </span>
  )
}

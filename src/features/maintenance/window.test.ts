import { describe, it, expect } from 'vitest'
import {
  EXTEND_STEPS,
  MAINTENANCE_KINDS,
  MAINTENANCE_PRESETS,
  autoMessage,
  backOnlineMessage,
  defaultWindow,
  formatCountdown,
  formatDuration,
  formatWindowRange,
  formatWindowSummary,
  fromDatetimeLocal,
  isUrgent,
  maintenancePhase,
  nextPhaseChangeAtMs,
  parseMaintenanceWindow,
  toDatetimeLocal,
  type MaintenanceWindow,
} from './window'

const START = 1_800_000_000_000
const END = START + 6 * 60 * 60 * 1000

function armed(overrides: Partial<MaintenanceWindow> = {}): MaintenanceWindow {
  return {
    enabled: true,
    startAtMs: START,
    endAtMs: END,
    message: 'Back soon.',
    mode: 'block',
    kind: 'maintenance',
    createdBy: 'user-1',
    createdByName: 'Deeghayu',
    ...overrides,
  }
}

/** The shape the database hands back, before parsing. */
function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    enabled: true,
    startAtMs: START,
    endAtMs: END,
    message: 'Back soon.',
    mode: 'block',
    kind: 'maintenance',
    createdBy: 'user-1',
    createdByName: 'Deeghayu',
    ...overrides,
  }
}

describe('maintenancePhase', () => {
  it('is off when nothing is armed', () => {
    expect(maintenancePhase(null, START)).toBe('off')
  })

  it('is off when a well-formed window is disabled', () => {
    expect(maintenancePhase(armed({ enabled: false }), START + 1000)).toBe('off')
  })

  it('is scheduled one millisecond before the start', () => {
    expect(maintenancePhase(armed(), START - 1)).toBe('scheduled')
  })

  // START INCLUSIVE. A window announced as starting at 20:00 that is not on at
  // 20:00:00.000 made a promise it did not keep.
  it('is active AT the start instant, not one tick later', () => {
    expect(maintenancePhase(armed(), START)).toBe('active')
  })

  it('is active for the last millisecond inside the window', () => {
    expect(maintenancePhase(armed(), END - 1)).toBe('active')
  })

  // END EXCLUSIVE, the mirror of the rule above: "back at 06:00" has to be
  // true at 06:00:00.000.
  it('is ended AT the end instant, not one tick later', () => {
    expect(maintenancePhase(armed(), END)).toBe('ended')
  })

  it('stays ended forever after — an ended row is inert, never re-arms itself', () => {
    expect(maintenancePhase(armed(), END + 30 * 24 * 60 * 60 * 1000)).toBe('ended')
  })

  it('is off when the clock itself is unusable', () => {
    expect(maintenancePhase(armed(), Number.NaN)).toBe('off')
  })
})

describe('parseMaintenanceWindow never locks anybody out', () => {
  // This block is the whole safety argument for the feature. Every input here
  // must read as "no maintenance", because the alternative is a malformed row
  // holding the entire workspace behind a screen nobody can dismiss.
  const lockoutAttempts: Array<[string, unknown]> = [
    ['null', null],
    ['undefined', undefined],
    ['a string', 'enabled'],
    ['a number', 1],
    ['an array', []],
    ['an empty object', {}],
    ['a missing start', row({ startAtMs: undefined })],
    ['a missing end', row({ endAtMs: undefined })],
    ['a null start', row({ startAtMs: null })],
    ['a non-numeric start', row({ startAtMs: 'soon' })],
    ['NaN for a start', row({ startAtMs: Number.NaN })],
    ['Infinity for an end', row({ endAtMs: Number.POSITIVE_INFINITY })],
    ['an end before the start', row({ endAtMs: START - 1 })],
    ['an end equal to the start', row({ endAtMs: START })],
    ['an unknown mode', row({ mode: 'panic' })],
    ['a missing mode', row({ mode: undefined })],
    ['an unknown kind', row({ kind: 'party' })],
    ['a missing kind', row({ kind: null })],
  ]

  for (const [label, raw] of lockoutAttempts) {
    it(`treats ${label} as off`, () => {
      const parsed = parseMaintenanceWindow(raw)
      expect(parsed).toBeNull()
      expect(maintenancePhase(parsed, START + 1000)).toBe('off')
    })
  }

  it('reads a well-formed row', () => {
    expect(parseMaintenanceWindow(row())).toEqual(armed())
  })

  // A bigint column over an HTTP driver comes back as a string often enough
  // that rejecting one would mean the window silently never activates.
  it('accepts millisecond columns that arrive as numeric strings', () => {
    const parsed = parseMaintenanceWindow(row({ startAtMs: String(START), endAtMs: String(END) }))
    expect(parsed?.startAtMs).toBe(START)
    expect(maintenancePhase(parsed, START)).toBe('active')
  })

  it('treats a truthy non-boolean enabled as off, not as armed', () => {
    const parsed = parseMaintenanceWindow(row({ enabled: 'yes' }))
    expect(parsed?.enabled).toBe(false)
    expect(maintenancePhase(parsed, START)).toBe('off')
  })

  it('survives a missing message and a missing author without failing the row', () => {
    const parsed = parseMaintenanceWindow(row({ message: undefined, createdByName: 42 }))
    expect(parsed?.message).toBe('')
    expect(parsed?.createdByName).toBe('an admin')
  })
})

describe('nextPhaseChangeAtMs', () => {
  it('points at the start while scheduled and the end while active', () => {
    expect(nextPhaseChangeAtMs(armed(), START - 1)).toBe(START)
    expect(nextPhaseChangeAtMs(armed(), START)).toBe(END)
  })

  it('has nothing pending once ended or off', () => {
    expect(nextPhaseChangeAtMs(armed(), END)).toBeNull()
    expect(nextPhaseChangeAtMs(null, START)).toBeNull()
  })
})

describe('formatCountdown', () => {
  it('clamps at zero rather than counting past the phase change', () => {
    expect(formatCountdown(0)).toBe('00:00')
    expect(formatCountdown(-5_000)).toBe('00:00')
    expect(formatCountdown(Number.NaN)).toBe('00:00')
  })

  it('reads MM:SS under an hour', () => {
    expect(formatCountdown(9_000)).toBe('00:09')
    expect(formatCountdown(65_000)).toBe('01:05')
    expect(formatCountdown(59 * 60_000 + 59_000)).toBe('59:59')
  })

  it('gains an hours field at exactly one hour', () => {
    expect(formatCountdown(60 * 60_000)).toBe('1:00:00')
    expect(formatCountdown(2 * 60 * 60_000 + 5 * 60_000 + 9_000)).toBe('2:05:09')
  })

  it('drops to days and hours past a day, where seconds stop meaning anything', () => {
    expect(formatCountdown(26 * 60 * 60_000)).toBe('1d 2h')
  })
})

describe('formatDuration', () => {
  it('names the window length the way a person would say it', () => {
    expect(formatDuration(45 * 60_000)).toBe('45m')
    expect(formatDuration(60 * 60_000)).toBe('1h')
    expect(formatDuration(90 * 60_000)).toBe('1h 30m')
    expect(formatDuration(10 * 60 * 60_000)).toBe('10h')
  })

  it('never rounds a real window down to nothing', () => {
    expect(formatDuration(1_000)).toBe('1m')
    expect(formatDuration(0)).toBe('0m')
  })
})

describe('datetime-local round trip', () => {
  // The input only carries minutes, so the round trip is lossless exactly to
  // the minute. Anything finer is the caller's to floor.
  it('returns the same minute it was given', () => {
    const ms = new Date(2026, 7, 21, 20, 0, 0, 0).getTime()
    expect(fromDatetimeLocal(toDatetimeLocal(ms))).toBe(ms)
  })

  it('drops seconds and milliseconds, and nothing else', () => {
    const noisy = new Date(2026, 7, 21, 20, 0, 47, 123).getTime()
    const floored = new Date(2026, 7, 21, 20, 0, 0, 0).getTime()
    expect(fromDatetimeLocal(toDatetimeLocal(noisy))).toBe(floored)
  })

  it('round trips a time in a month where a UTC slice would land on the wrong day', () => {
    const lateNight = new Date(2026, 0, 1, 23, 45, 0, 0).getTime()
    expect(toDatetimeLocal(lateNight)).toBe('2026-01-01T23:45')
    expect(fromDatetimeLocal('2026-01-01T23:45')).toBe(lateNight)
  })

  it('refuses anything the input could not have produced', () => {
    expect(fromDatetimeLocal('')).toBeNull()
    expect(fromDatetimeLocal('tonight')).toBeNull()
    expect(fromDatetimeLocal('2026-08-21')).toBeNull()
    expect(fromDatetimeLocal('2026-02-31T10:00')).toBeNull()
  })
})

describe('defaultWindow and the presets', () => {
  it('opens on tonight 20:00 through 06:00 tomorrow', () => {
    const noon = new Date(2026, 7, 21, 12, 0, 0, 0).getTime()
    const { startAtMs, endAtMs } = defaultWindow(noon)
    expect(toDatetimeLocal(startAtMs)).toBe('2026-08-21T20:00')
    expect(toDatetimeLocal(endAtMs)).toBe('2026-08-22T06:00')
  })

  // Opening the popup at 21:00 must not propose a window that is already an
  // hour old, which would arm straight into 'active'.
  it('rolls to tomorrow once tonight 20:00 has passed', () => {
    const latish = new Date(2026, 7, 21, 21, 30, 0, 0).getTime()
    const { startAtMs, endAtMs } = defaultWindow(latish)
    expect(toDatetimeLocal(startAtMs)).toBe('2026-08-22T20:00')
    expect(toDatetimeLocal(endAtMs)).toBe('2026-08-23T06:00')
    expect(maintenancePhase(armed({ startAtMs, endAtMs }), latish)).toBe('scheduled')
  })

  it('gives every preset a window that ends after it starts', () => {
    const now = new Date(2026, 7, 21, 14, 0, 0, 0).getTime()
    for (const preset of MAINTENANCE_PRESETS) {
      const { startAtMs, endAtMs } = preset.resolve(now)
      expect(endAtMs, preset.id).toBeGreaterThan(startAtMs)
      expect(parseMaintenanceWindow(row({ startAtMs, endAtMs })), preset.id).not.toBeNull()
    }
  })

  it('sends "Now → 06:00" to the next 06:00, never to one that has passed', () => {
    const preset = MAINTENANCE_PRESETS.find((p) => p.id === 'now-six')!
    const morning = new Date(2026, 7, 21, 7, 0, 0, 0).getTime()
    expect(toDatetimeLocal(preset.resolve(morning).endAtMs)).toBe('2026-08-22T06:00')
    const evening = new Date(2026, 7, 21, 22, 0, 0, 0).getTime()
    expect(toDatetimeLocal(preset.resolve(evening).endAtMs)).toBe('2026-08-22T06:00')
  })

  it('offers extend steps that only ever push the end later', () => {
    expect(EXTEND_STEPS.length).toBeGreaterThan(0)
    for (const step of EXTEND_STEPS) expect(step.ms).toBeGreaterThan(0)
  })
})

describe('formatWindowRange', () => {
  // A fixed zone, so the assertion is about the formatting rule rather than
  // about whatever zone the test machine happens to be in.
  const TZ = 'Asia/Colombo'

  it('prints one date for a window that stays inside a day', () => {
    const start = Date.UTC(2026, 7, 21, 8, 30) // 14:00 in Colombo
    const end = Date.UTC(2026, 7, 21, 11, 30) // 17:00 in Colombo
    expect(formatWindowRange(start, end, TZ)).toBe('21 Aug, 14:00–17:00')
  })

  it('prints both dates for a window that crosses midnight', () => {
    const start = Date.UTC(2026, 7, 21, 14, 30) // 20:00 in Colombo
    const end = Date.UTC(2026, 7, 22, 0, 30) // 06:00 next day in Colombo
    expect(formatWindowRange(start, end, TZ)).toBe('21 Aug, 20:00 → 22 Aug, 06:00')
  })

  it('says so plainly when the window is inside out', () => {
    expect(formatWindowSummary(END, START, TZ)).toBe('End time must be after the start time.')
  })

  it('puts the length on the summary line', () => {
    expect(formatWindowSummary(START, END, TZ)).toContain('6h')
  })
})

describe('autoMessage', () => {
  const TZ = 'Asia/Colombo'

  it('says something different for each kind', () => {
    const messages = MAINTENANCE_KINDS.map((kind) => autoMessage(kind, START, END, TZ))
    expect(new Set(messages).size).toBe(MAINTENANCE_KINDS.length)
  })

  it('asks people to save before planned work', () => {
    expect(autoMessage('maintenance', START, END, TZ)).toContain('save')
  })

  it('explains the absence for an upgrade rather than asking for anything', () => {
    const message = autoMessage('upgrade', START, END, TZ)
    expect(message).toContain('new version')
    expect(message).not.toContain('save')
  })

  it('apologises for the notice an emergency could not give', () => {
    expect(autoMessage('emergency', START, END, TZ)).toContain('short notice')
  })

  it('always carries the window and its length, whatever the kind', () => {
    for (const kind of MAINTENANCE_KINDS) {
      const message = autoMessage(kind, START, END, TZ)
      expect(message, kind).toContain(formatWindowRange(START, END, TZ))
      expect(message, kind).toContain(formatDuration(END - START))
    }
  })

  it('has a matching back-online line for every kind', () => {
    for (const kind of MAINTENANCE_KINDS) {
      expect(backOnlineMessage(kind), kind).toContain('back online')
    }
  })
})

describe('isUrgent', () => {
  it('turns urgent at ten minutes out and stays urgent after', () => {
    expect(isUrgent(11 * 60_000)).toBe(false)
    expect(isUrgent(10 * 60_000)).toBe(true)
    expect(isUrgent(0)).toBe(true)
  })
})

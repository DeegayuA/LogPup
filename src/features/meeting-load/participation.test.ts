import { describe, expect, it } from 'vitest'
import {
  isLowParticipation, participationFor, seriesParticipationMedians,
} from './participation'

describe('participationFor', () => {
  it('counts every segment as a turn and only resolved ones as speakers', () => {
    const result = participationFor('m1', [
      { meetingId: 'm1', speakerId: 's1' },
      { meetingId: 'm1', speakerId: 's2' },
      { meetingId: 'm1', speakerId: 's1' },
      // Somebody spoke and was never resolved to a person. It happened, so it
      // is a turn; it names nobody, so it adds no speaker.
      { meetingId: 'm1', speakerId: null },
    ])
    expect(result).toEqual({ meetingId: 'm1', turns: 4, mappedSpeakers: 2 })
  })

  it('ignores other meetings’ segments', () => {
    expect(participationFor('m1', [{ meetingId: 'm2', speakerId: 's1' }]).turns).toBe(0)
  })

  it('trusts the caller’s voice filter rather than re-applying one', () => {
    // Source discrimination is a database question; a second opinion here would
    // be a second place for it to go wrong. Everything handed over counts.
    expect(participationFor('m1', [{ meetingId: 'm1', speakerId: null }]).turns).toBe(1)
  })

  it('is zero for an occurrence nobody recorded', () => {
    expect(participationFor('m1', [])).toEqual({ meetingId: 'm1', turns: 0, mappedSpeakers: 0 })
  })
})

describe('seriesParticipationMedians', () => {
  const occ = (turns: number, mappedSpeakers: number) => ({ meetingId: 'm', turns, mappedSpeakers })

  it('takes the middle value on an odd count', () => {
    expect(seriesParticipationMedians([occ(2, 1), occ(30, 5), occ(10, 3)]))
      .toEqual({ medianVoiceTurns: 10, medianMappedSpeakers: 3 })
  })

  it('averages the two middle values on an even count', () => {
    expect(seriesParticipationMedians([occ(2, 1), occ(4, 2), occ(6, 3), occ(8, 4)]))
      .toEqual({ medianVoiceTurns: 5, medianMappedSpeakers: 2.5 })
  })

  it('is zero for an empty series rather than NaN', () => {
    expect(seriesParticipationMedians([]))
      .toEqual({ medianVoiceTurns: 0, medianMappedSpeakers: 0 })
  })
})

describe('isLowParticipation — the cancel veto', () => {
  it('is true at both vetoing edges', () => {
    expect(isLowParticipation({ medianMappedSpeakers: 2, medianVoiceTurns: 9 })).toBe(true)
  })

  it('is false once a third voice joins', () => {
    expect(isLowParticipation({ medianMappedSpeakers: 3, medianVoiceTurns: 9 })).toBe(false)
  })

  it('is false at exactly ten turns — ten is not "under ten"', () => {
    expect(isLowParticipation({ medianMappedSpeakers: 2, medianVoiceTurns: 10 })).toBe(false)
  })

  it('reads a busy design crit as high participation', () => {
    // The single most important negative case in the suite: six people arguing
    // for forty turns and writing nothing down must never look cancellable.
    expect(isLowParticipation({ medianMappedSpeakers: 6, medianVoiceTurns: 40 })).toBe(false)
  })

  it('reads a two-person eight-turn series as low', () => {
    expect(isLowParticipation({ medianMappedSpeakers: 2, medianVoiceTurns: 8 })).toBe(true)
  })
})

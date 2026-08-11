import { describe, it, expect } from 'vitest'
import {
  shouldSwitchLanguage,
  otherLanguage,
  CONFIDENCE_WINDOW_SIZE,
  CONFIDENCE_SWITCH_THRESHOLD,
  SWITCH_COOLDOWN_MS,
} from './language-switch'

// Sanity check on the tuned constants themselves — if these ever drift the
// scenarios below (built around "clearly above" / "clearly below" values)
// could quietly stop testing what they claim to.
describe('tuned constants', () => {
  it('threshold sits strictly between 0 and 1', () => {
    expect(CONFIDENCE_SWITCH_THRESHOLD).toBeGreaterThan(0)
    expect(CONFIDENCE_SWITCH_THRESHOLD).toBeLessThan(1)
  })

  it('window requires more than one sample', () => {
    expect(CONFIDENCE_WINDOW_SIZE).toBeGreaterThan(1)
  })
})

describe('shouldSwitchLanguage', () => {
  const readyToSwitch = SWITCH_COOLDOWN_MS // exactly at the cooldown boundary

  it('switches when the rolling average is below threshold and enough samples exist', () => {
    const confidences = Array(CONFIDENCE_WINDOW_SIZE).fill(CONFIDENCE_SWITCH_THRESHOLD - 0.2)
    expect(
      shouldSwitchLanguage({ confidences, currentLang: 'en-US', msSinceLastSwitch: readyToSwitch })
    ).toBe(true)
  })

  it('does not switch when the rolling average is above threshold', () => {
    const confidences = Array(CONFIDENCE_WINDOW_SIZE).fill(CONFIDENCE_SWITCH_THRESHOLD + 0.2)
    expect(
      shouldSwitchLanguage({ confidences, currentLang: 'en-US', msSinceLastSwitch: readyToSwitch })
    ).toBe(false)
  })

  it('does not switch when there are not yet enough samples, even if they are all low', () => {
    const confidences = Array(CONFIDENCE_WINDOW_SIZE - 1).fill(0.1)
    expect(
      shouldSwitchLanguage({ confidences, currentLang: 'en-US', msSinceLastSwitch: readyToSwitch })
    ).toBe(false)
  })

  it('does not switch on zero samples', () => {
    expect(
      shouldSwitchLanguage({ confidences: [], currentLang: 'si-LK', msSinceLastSwitch: readyToSwitch })
    ).toBe(false)
  })

  it('blocks an otherwise-valid switch during the cooldown window', () => {
    const confidences = Array(CONFIDENCE_WINDOW_SIZE).fill(0.1)
    expect(
      shouldSwitchLanguage({ confidences, currentLang: 'en-US', msSinceLastSwitch: SWITCH_COOLDOWN_MS - 1 })
    ).toBe(false)
  })

  it('allows a switch the instant the cooldown elapses', () => {
    const confidences = Array(CONFIDENCE_WINDOW_SIZE).fill(0.1)
    expect(
      shouldSwitchLanguage({ confidences, currentLang: 'en-US', msSinceLastSwitch: SWITCH_COOLDOWN_MS })
    ).toBe(true)
  })

  it('only weighs the most recent window, ignoring older history', () => {
    // A long run of terrible confidence followed by a strong recent run
    // should read as "fine now", not be dragged down by ancient history.
    const oldBad = Array(10).fill(0.05)
    const recentGood = Array(CONFIDENCE_WINDOW_SIZE).fill(0.95)
    expect(
      shouldSwitchLanguage({
        confidences: [...oldBad, ...recentGood],
        currentLang: 'en-US',
        msSinceLastSwitch: readyToSwitch,
      })
    ).toBe(false)
  })

  it('a single low sample among otherwise-confident ones does not average below threshold', () => {
    // One rough word shouldn't be enough on its own — the point of
    // averaging over a window rather than reacting to one result.
    const confidences = [0.95, 0.9, 0.92, 0.1]
    expect(
      shouldSwitchLanguage({ confidences, currentLang: 'en-US', msSinceLastSwitch: readyToSwitch })
    ).toBe(false)
  })
})

describe('otherLanguage', () => {
  it('flips English to Sinhala', () => {
    expect(otherLanguage('en-US')).toBe('si-LK')
  })

  it('flips Sinhala to English', () => {
    expect(otherLanguage('si-LK')).toBe('en-US')
  })
})

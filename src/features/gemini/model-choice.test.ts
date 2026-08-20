import { describe, expect, it } from 'vitest'
import { resolveChain } from '@/features/gemini/model-choice'
import { QUICK_MODELS } from '@/features/gemini/models'

describe('resolveChain', () => {
  it('returns the default chain untouched when nothing is chosen', () => {
    expect(resolveChain('app-metadata', null)).toEqual([...QUICK_MODELS])
  })

  it('prepends the chosen model, keeping the default chain as fallback', () => {
    const chain = resolveChain('app-metadata', 'gemini-2.5-pro')
    expect(chain[0]).toBe('gemini-2.5-pro')
    expect(chain.slice(1)).toEqual([...QUICK_MODELS])
  })

  it('never attempts the same model twice', () => {
    const chosen = QUICK_MODELS[0]
    const chain = resolveChain('app-metadata', chosen)
    expect(chain.filter((m) => m === chosen)).toHaveLength(1)
    expect(chain[0]).toBe(chosen)
  })

  it('keeps a fallback even when the choice is already the chain head', () => {
    expect(resolveChain('app-metadata', QUICK_MODELS[0]).length).toBeGreaterThan(1)
  })
})

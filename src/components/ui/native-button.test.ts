import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { inferNativeButton } from './native-button'

function Link() {
  return null
}

describe('inferNativeButton', () => {
  it('keeps the native default when nothing replaces the element', () => {
    expect(inferNativeButton(undefined, undefined)).toBe(true)
  })

  it('stays native when the render element is a <button>', () => {
    expect(inferNativeButton(createElement('button', { type: 'submit' }), undefined)).toBe(true)
  })

  it('turns non-native for an anchor', () => {
    expect(inferNativeButton(createElement('a', { href: '/x' }), undefined)).toBe(false)
  })

  it('turns non-native for a component element such as next/link', () => {
    expect(inferNativeButton(createElement(Link), undefined)).toBe(false)
  })

  it('turns non-native for a span', () => {
    expect(inferNativeButton(createElement('span'), undefined)).toBe(false)
  })

  it('cannot see inside a render function, so leaves the default alone', () => {
    expect(inferNativeButton(() => createElement('a'), undefined)).toBe(true)
  })

  it('an explicit prop always wins over inference', () => {
    expect(inferNativeButton(createElement('a'), true)).toBe(true)
    expect(inferNativeButton(createElement('button'), false)).toBe(false)
    expect(inferNativeButton(undefined, false)).toBe(false)
  })
})

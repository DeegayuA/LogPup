import { describe, expect, it } from 'vitest'
import { mentionHref, remarkMentions, splitMentions } from './mentions'

const ann = { id: 'u-ann', name: 'Ann' }
const annP = { id: 'u-annp', name: 'Ann Perera' }
const bo = { id: 'u-bo', name: 'Bo' }

describe('splitMentions', () => {
  it('leaves text without a known @name alone', () => {
    expect(splitMentions('hello there', [ann])).toEqual([{ type: 'text', value: 'hello there' }])
    expect(splitMentions('mail ann@example.com', [ann])).toEqual([{ type: 'text', value: 'mail ann@example.com' }])
    expect(splitMentions('@Annabel hi', [ann])).toEqual([{ type: 'text', value: '@Annabel hi' }])
  })

  it('matches the longest name, case-insensitively, before punctuation', () => {
    expect(splitMentions('hi @ann perera, and @BO!', [ann, annP, bo])).toEqual([
      { type: 'text', value: 'hi ' },
      { type: 'mention', value: '@ann perera', person: annP },
      { type: 'text', value: ', and ' },
      { type: 'mention', value: '@BO', person: bo },
      { type: 'text', value: '!' },
    ])
  })

  it('matches at the very start and end', () => {
    expect(splitMentions('@Ann', [ann])).toEqual([{ type: 'mention', value: '@Ann', person: ann }])
  })
})

type Node = { type: string; value?: string; url?: string; children?: Node[]; data?: { hProperties?: Record<string, unknown> } }

function run(tree: Node, people = [ann, bo]) {
  const transformer = remarkMentions(people)()
  transformer(tree)
  return tree
}

describe('remarkMentions', () => {
  it('turns a mention in a paragraph into a profile link marked data-mention', () => {
    const tree = run({ type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value: 'ping @Bo now' }] }] })
    const para = tree.children![0]
    expect(para.children).toEqual([
      { type: 'text', value: 'ping ' },
      {
        type: 'link',
        url: mentionHref(bo),
        title: null,
        children: [{ type: 'text', value: '@Bo' }],
        data: { hProperties: { dataMention: 'u-bo' } },
      },
      { type: 'text', value: ' now' },
    ])
  })

  it('never rewrites code, inline code, or text already inside a link', () => {
    const tree = run({
      type: 'root',
      children: [
        { type: 'code', value: '@Bo' },
        {
          type: 'paragraph',
          children: [
            { type: 'inlineCode', value: '@Bo' },
            { type: 'link', url: 'https://x.test', children: [{ type: 'text', value: '@Bo' }] },
          ],
        },
      ],
    })
    expect(JSON.stringify(tree)).not.toContain('dataMention')
  })

  it('reaches text nested in emphasis', () => {
    const tree = run({
      type: 'root',
      children: [{ type: 'paragraph', children: [{ type: 'strong', children: [{ type: 'text', value: '@Ann' }] }] }],
    })
    expect(JSON.stringify(tree)).toContain('"dataMention":"u-ann"')
  })
})

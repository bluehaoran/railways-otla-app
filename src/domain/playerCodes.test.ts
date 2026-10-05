import { describe, expect, it } from 'vitest'
import { codeProblems, playerCodes } from './playerCodes'

const unique = (codes: string[]) => new Set(codes.map((c) => c.toLowerCase())).size === codes.length

describe('playerCodes (spec D3 test 11)', () => {
  it('uses the first letter when there is no clash', () => {
    expect(playerCodes(['Haoran', 'Ari', 'John'])).toEqual(['H', 'A', 'J'])
  })

  it('extends clashing names to the shortest unique prefix', () => {
    expect(playerCodes(['John', 'James'])).toEqual(['Jo', 'Ja'])
    expect(playerCodes(['Haoran', 'Ari', 'John', 'James'])).toEqual(['H', 'A', 'Jo', 'Ja'])
  })

  it('handles a name that is a prefix of another', () => {
    expect(playerCodes(['Jo', 'John'])).toEqual(['Jo', 'Joh'])
  })

  it('appends a digit to identical names', () => {
    expect(playerCodes(['John', 'John'])).toEqual(['John1', 'John2'])
  })

  it('uppercases the first letter', () => {
    expect(playerCodes(['haoran', 'ari'])).toEqual(['H', 'A'])
  })
})

// Review Focus 2.
describe('playerCodes with awkward names', () => {
  it('treats names that differ only by case as identical', () => {
    expect(playerCodes(['john', 'JOHN'])).toEqual(['John1', 'John2'])
  })

  it('gives an empty or blank name a placeholder code', () => {
    const codes = playerCodes(['', '   ', 'Ari'])
    expect(codes).toEqual(['P1', 'P2', 'A'])
  })

  it('ignores surrounding spaces', () => {
    expect(playerCodes(['  John ', 'James'])).toEqual(['Jo', 'Ja'])
  })

  it('keeps an emoji or a digit as a whole first character', () => {
    expect(playerCodes(['😀 Sam', '7of9'])).toEqual(['😀', '7'])
  })

  it('stays unique and non-empty for any mix', () => {
    const cases = [
      ['John', 'John', 'James', 'Jo', 'J'],
      ['P2', '', 'P1', ''],
      ['John1', 'John', 'John'],
      ['A', 'a', 'Ab', 'AB', 'abc'],
      ['', '', '', '', ''],
    ]
    for (const names of cases) {
      const codes = playerCodes(names)
      expect(codes, names.join('|')).toHaveLength(names.length)
      expect(codes.every((c) => c.length > 0), names.join('|')).toBe(true)
      expect(unique(codes), `${names.join('|')} -> ${codes.join('|')}`).toBe(true)
    }
  })
})

describe('codeProblems', () => {
  it('flags empty and duplicate codes, ignoring case', () => {
    expect(codeProblems(['H', 'A', 'Jo'])).toEqual([null, null, null])
    expect(codeProblems(['H', ' ', 'h'])).toEqual([
      'This code is already used',
      'Enter a code',
      'This code is already used',
    ])
  })
})

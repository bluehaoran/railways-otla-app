import { describe, expect, it } from 'vitest'
import { TRACK, findToken, moveToken, placeToken, priceOf, snapDown, startPrice, startPrices, zoneOf } from './track'
import { put, testGame } from './fixtures'

function moved(result: ReturnType<typeof moveToken>) {
  if (result.kind !== 'moved') throw new Error('expected a move')
  return result.game
}

describe('TRACK and snapDown', () => {
  it('has 27 positions from 0 to 500', () => {
    expect(TRACK).toHaveLength(27)
    expect(TRACK[0]).toBe(0)
    expect(TRACK[26]).toBe(500)
  })

  it('snaps down to a track position', () => {
    expect(snapDown(87.5)).toBe(80)
    expect(snapDown(137)).toBe(135)
    expect(snapDown(9)).toBe(0)
    expect(snapDown(80)).toBe(80)
    expect(snapDown(9999)).toBe(500)
  })

  it('returns 0 for a negative value or NaN', () => {
    expect(snapDown(-5)).toBe(0)
    expect(snapDown(Number.NaN)).toBe(0)
  })

  it('names the zone of a price', () => {
    expect([0, 50, 60, 90, 100, 110, 120, 135, 150].map(zoneOf)).toEqual([
      'closed', 'none', 'yellow', 'yellow', 'green', 'green', 'purple', 'purple', 'none',
    ])
  })
})

describe('startPrice', () => {
  it('halves the bid, snaps down, and clamps to the phase', () => {
    expect(startPrice(120, 'yellow')).toBe(60)
    expect(startPrice(160, 'yellow')).toBe(80)
    expect(startPrice(175, 'yellow')).toBe(80)
    expect(startPrice(130, 'yellow')).toBe(60)
    expect(startPrice(200, 'yellow')).toBe(90)
    expect(startPrice(200, 'green')).toBe(100)
    expect(startPrice(300, 'green')).toBe(110)
    expect(startPrice(300, 'purple')).toBe(135)
  })

  it('rejects a bid below 120 or not a multiple of 5', () => {
    expect(() => startPrice(115, 'yellow')).toThrow(RangeError)
    expect(() => startPrice(122, 'yellow')).toThrow(RangeError)
    expect(() => startPrice(Number.NaN, 'yellow')).toThrow(RangeError)
  })

  it('lists the allowed start prices of a phase', () => {
    expect(startPrices('yellow')).toEqual([60, 70, 80, 90])
    expect(startPrices('green')).toEqual([60, 70, 80, 90, 100, 110])
    expect(startPrices('purple')).toEqual([60, 70, 80, 90, 100, 110, 120, 135])
  })
})

describe('moveToken', () => {
  it('moves up 2 from 110 to 135', () => {
    const g = put(testGame(), 'express', { price: 110 })
    expect(priceOf(moved(moveToken(g, 'express', 2)), 'express')).toBe(135)
  })

  it('stays at 500 when moved up, and goes to the back of the queue', () => {
    let g = put(testGame(), 'express', { price: 500 })
    g = put(g, 'tunneling', { price: 500 })
    const after = moved(moveToken(g, 'express', 1))
    expect(after.track[26]).toEqual(['tunneling', 'express'])
  })

  it('asks to close when a move reaches 0', () => {
    const g = put(testGame(), 'express', { price: 10 })
    expect(moveToken(g, 'express', -1)).toEqual({ kind: 'close', companyId: 'express' })
    expect(moveToken(g, 'express', -5)).toEqual({ kind: 'close', companyId: 'express' })
  })

  it('joins the back of an occupied queue', () => {
    let g = put(testGame(), 'express', { price: 80 })
    g = put(g, 'tunneling', { price: 70 })
    const after = moved(moveToken(g, 'tunneling', 1))
    expect(after.track[8]).toEqual(['express', 'tunneling'])
    expect(after.track[7]).toEqual([])
  })

  it('does not change the game it was given', () => {
    const g = put(testGame(), 'express', { price: 80 })
    const before = JSON.stringify(g)
    moveToken(g, 'express', 1)
    expect(JSON.stringify(g)).toBe(before)
  })

  it('throws for a company that is not on the track', () => {
    expect(() => moveToken(testGame(), 'express', 1)).toThrow()
  })
})

describe('placeToken', () => {
  it('puts a token at a chosen queue slot', () => {
    let g = put(testGame(), 'express', { price: 80 })
    g = put(g, 'tunneling', { price: 80 })
    g = put(g, 'suburban', { price: 60 })
    const after = moved(placeToken(g, 'suburban', 8, 0))
    expect(after.track[8]).toEqual(['suburban', 'express', 'tunneling'])
    expect(findToken(after, 'suburban')).toEqual({ index: 8, slot: 0 })
  })

  it('reorders inside one queue', () => {
    let g = put(testGame(), 'express', { price: 80 })
    g = put(g, 'tunneling', { price: 80 })
    expect(moved(placeToken(g, 'express', 8)).track[8]).toEqual(['tunneling', 'express'])
    expect(moved(placeToken(g, 'tunneling', 8, 0)).track[8]).toEqual(['tunneling', 'express'])
  })

  it('asks to close for position 0 and rejects a position off the track', () => {
    const g = put(testGame(), 'express', { price: 80 })
    expect(placeToken(g, 'express', 0)).toEqual({ kind: 'close', companyId: 'express' })
    expect(() => placeToken(g, 'express', 27)).toThrow(RangeError)
    expect(() => placeToken(g, 'express', 2.5)).toThrow(RangeError)
  })
})

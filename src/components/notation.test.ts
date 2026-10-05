import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ShareCircle from './ShareCircle.vue'
import CompanyTag from './CompanyTag.vue'
import TokenChip from './TokenChip.vue'
import CountStepper from './CountStepper.vue'
import EditBanner from './EditBanner.vue'
import PlayerCode from './PlayerCode.vue'
import { ordinal } from '../domain/format'

describe('ordinal', () => {
  it('formats positions', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd',
    ])
  })
})

describe('ShareCircle', () => {
  it('shows the holder code on the company color with a readable ink', () => {
    const w = mount(ShareCircle, { props: { kind: 'share', companyId: 'express', code: 'H' } })
    expect(w.text()).toBe('H')
    expect(w.attributes('data-kind')).toBe('share')
    expect(w.attributes('aria-label')).toBe('Share held by H')
    expect(w.attributes('style')).toContain('background: rgb(159, 56, 65)')
    expect(w.attributes('style')).toContain('color: rgb(255, 255, 255)')
    expect(w.find('svg').exists()).toBe(false)
  })

  it('marks the president card with a crown above the code', () => {
    const w = mount(ShareCircle, { props: { kind: 'president', companyId: 'express', code: 'H' } })
    expect(w.find('svg').exists()).toBe(true)
    expect(w.text()).toBe('H')
    expect(w.attributes('aria-label')).toBe('President card held by H, counts as 2 shares')
  })

  it('draws treasury and market shares as rings without a letter', () => {
    const treasury = mount(ShareCircle, { props: { kind: 'treasury' } })
    const market = mount(ShareCircle, { props: { kind: 'market' } })
    expect(treasury.text()).toBe('')
    expect(treasury.classes()).toContain('treasury')
    expect(treasury.attributes('aria-label')).toBe('Treasury share')
    expect(market.classes()).toContain('market')
    expect(market.attributes('aria-label')).toBe('Market share')
    expect(treasury.attributes('style')).toBeUndefined()
  })

  it('swaps fill and ink when inverted', () => {
    const w = mount(ShareCircle, { props: { kind: 'president', companyId: 'express', code: 'H', inverted: true } })
    expect(w.attributes('style')).toContain('background: rgb(255, 255, 255)')
    expect(w.attributes('style')).toContain('color: rgb(159, 56, 65)')
  })
})

describe('CompanyTag', () => {
  it('shows the abbreviation with black text on Consortium red', () => {
    const w = mount(CompanyTag, { props: { companyId: 'consortium' } })
    expect(w.text()).toBe('C')
    expect(w.attributes('style')).toContain('color: rgb(0, 0, 0)')
  })
})

describe('TokenChip', () => {
  it('is a labelled button with the abbreviation and the president code', () => {
    const w = mount(TokenChip, {
      props: { companyId: 'express', presidentCode: 'H', label: 'Express at 110, president H' },
    })
    expect(w.element.tagName).toBe('BUTTON')
    expect(w.attributes('aria-label')).toBe('Express at 110, president H')
    expect(w.attributes('data-id')).toBe('express')
    expect(w.text()).toContain('XP')
    expect(w.text()).toContain('H')
    expect(w.find('.rank').exists()).toBe(false)
  })

  it('shows its queue rank and its selected state', () => {
    const w = mount(TokenChip, {
      props: { companyId: 'express', presidentCode: 'H', label: 'x', rank: 2, selected: true },
    })
    expect(w.find('.rank').text()).toBe('2')
    expect(w.attributes('aria-pressed')).toBe('true')
  })
})

describe('CountStepper', () => {
  it('emits the next value and stops at 0', async () => {
    const w = mount(CountStepper, { props: { modelValue: 1, label: 'Express, H' } })
    await w.get('[aria-label="Increase Express, H"]').trigger('click')
    await w.get('[aria-label="Decrease Express, H"]').trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([[2], [0]])

    const zero = mount(CountStepper, { props: { modelValue: 0, label: 'x' } })
    expect(zero.get('[aria-label="Decrease x"]').attributes('disabled')).toBeDefined()
  })
})

describe('EditBanner and PlayerCode', () => {
  it('emits done', async () => {
    const w = mount(EditBanner)
    expect(w.text()).toContain('Edit mode')
    await w.get('button').trigger('click')
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('shows a code', () => {
    expect(mount(PlayerCode, { props: { code: 'Jo' } }).text()).toBe('Jo')
  })
})

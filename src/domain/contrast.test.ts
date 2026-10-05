import { describe, expect, it } from 'vitest'
import { contrast, inkFor } from './contrast'
import { COMPANIES, COMPANY_IDS, MAJOR_IDS, MINOR_IDS } from './companies'

describe('contrast', () => {
  it('gives 21 for black on white', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1)
  })
})

describe('inkFor', () => {
  // The ink column of docs/design/boards/Components.dc.html.
  const expected: Record<string, string> = {
    consortium: '#000000',
    union: '#18181b',
    system: '#18181b',
    international: '#18181b',
    federation: '#18181b',
    experiment: '#ffffff',
    spacious: '#18181b',
    adaptive: '#18181b',
    bridging: '#18181b',
    overnight: '#ffffff',
    tunneling: '#18181b',
    resourceful: '#18181b',
    easternMining: '#18181b',
    agricultural: '#ffffff',
    northernPort: '#ffffff',
    expansive: '#18181b',
    express: '#ffffff',
    suburban: '#18181b',
  }

  it('matches the design board for all 18 companies', () => {
    for (const id of COMPANY_IDS) {
      expect(COMPANIES[id].ink, id).toBe(expected[id])
    }
  })

  it('reaches 4.5:1 for every company color', () => {
    for (const id of COMPANY_IDS) {
      expect(contrast(inkFor(COMPANIES[id].color), COMPANIES[id].color), id).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('company catalogue', () => {
  it('has 6 majors and 12 minors', () => {
    expect(MAJOR_IDS).toHaveLength(6)
    expect(MINOR_IDS).toHaveLength(12)
  })

  it('keeps only known names for a major', () => {
    expect(COMPANIES.system.names).toEqual(['System', 'Syndicate'])
    expect(COMPANIES.experiment.names).toEqual(['Experiment', 'Enterprise'])
    expect(COMPANIES.federation.names).toEqual(['Federation'])
  })
})

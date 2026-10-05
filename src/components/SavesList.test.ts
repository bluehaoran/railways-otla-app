import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import SavesList from './SavesList.vue'
import { createSaves, exportGame } from '../state/saves'
import { memoryStorage } from '../state/memoryStorage'
import { testGame } from '../domain/fixtures'
import type { Game } from '../domain/types'

const confirmRequire = vi.fn()
const toastAdd = vi.fn()
const downloadText = vi.fn()
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: confirmRequire }) }))
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }))
vi.mock('../state/download', () => ({ downloadText: (...args: unknown[]) => downloadText(...args) }))

const game = (id: string, name: string): Game => ({ ...testGame(['Haoran', 'Ari']), id, name })

function setup() {
  const saves = createSaves(memoryStorage())
  saves.write({ schemaVersion: 1, game: game('g1', 'Friday game'), undo: [], redo: [] })
  saves.write({ schemaVersion: 1, game: game('g2', 'Sunday game'), undo: [], redo: [] })
  const w = mount(SavesList, { props: { saves, currentId: 'g1' } })
  return { saves, w }
}

const rowOf = (w: VueWrapper, id: string) => w.get(`[data-save="${id}"]`).element.closest('tr')!
const action = (w: VueWrapper, id: string, label: string) => w.get(`[data-save="${id}"] ~ * [aria-label="${label}"], [aria-label="${label} ${id}"]`)

async function importFile(w: VueWrapper, text: string) {
  const input = w.get('input[type="file"]')
  const file = new File([text], 'game.json', { type: 'application/json' })
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

beforeEach(() => {
  confirmRequire.mockReset()
  toastAdd.mockReset()
  downloadText.mockReset()
})

describe('SavesList', () => {
  it('lists saved games, most recent first, and marks the open one', () => {
    const { w } = setup()
    expect(w.findAll('[data-save]').map((e) => e.attributes('data-save'))).toEqual(['g2', 'g1'])
    expect(rowOf(w, 'g1').textContent).toContain('Friday game')
    expect(rowOf(w, 'g1').textContent).toContain('Haoran, Ari')
    expect(rowOf(w, 'g1').textContent).toContain('Open now')
    expect(rowOf(w, 'g2').textContent).not.toContain('Open now')
  })

  it('emits open', async () => {
    const { w } = setup()
    await action(w, 'g2', 'Open').trigger('click')
    expect(w.emitted('open')).toEqual([['g2']])
  })

  it('duplicates a game', async () => {
    const { w, saves } = setup()
    await action(w, 'g2', 'Duplicate').trigger('click')
    expect(saves.index.value).toHaveLength(3)
    expect(w.text()).toContain('Sunday game copy')
  })

  it('exports a game as a file', async () => {
    const { w } = setup()
    await action(w, 'g1', 'Export').trigger('click')
    expect(downloadText).toHaveBeenCalledWith('friday-game.lost-atlas.json', exportGame(game('g1', 'Friday game')))
  })

  it('emits remove after a confirm', async () => {
    const { w } = setup()
    await action(w, 'g2', 'Delete').trigger('click')
    expect(w.emitted('remove')).toBeUndefined()
    expect(confirmRequire.mock.calls[0][0].message).toContain('Sunday game')
    confirmRequire.mock.calls[0][0].accept()
    expect(w.emitted('remove')).toEqual([['g2']])
  })

  it('emits rename with the new name', async () => {
    const { w } = setup()
    await action(w, 'g2', 'Rename').trigger('click')
    await w.get('[data-testid="rename-input"]').setValue('Monday game')
    await w.get('[data-testid="rename-save"]').trigger('click')
    expect(w.emitted('rename')).toEqual([['g2', 'Monday game']])
  })

  it('imports a file as a new saved game', async () => {
    const { w, saves } = setup()
    await importFile(w, exportGame(game('g9', 'Imported game')))
    expect(saves.index.value.map((e) => e.name)).toContain('Imported game')
    expect(toastAdd.mock.calls[0][0]).toMatchObject({ severity: 'success' })
  })

  // Review Focus 3.
  it('shows a clear message for a bad file and changes nothing', async () => {
    const { w, saves } = setup()
    await importFile(w, 'this is not json')
    expect(saves.index.value).toHaveLength(2)
    expect(toastAdd.mock.calls[0][0]).toMatchObject({ severity: 'error', detail: 'This file is not valid JSON.' })
  })

  it('shows an empty state', () => {
    const w = mount(SavesList, { props: { saves: createSaves(memoryStorage()), currentId: null } })
    expect(w.text()).toContain('No saved games yet')
  })
})

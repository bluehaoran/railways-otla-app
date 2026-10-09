import { useStorage } from '@vueuse/core'
import { COMPANY_IDS } from '../domain/companies'
import { MAX_COUNT } from '../domain/edit'
import { newId } from '../domain/setup'
import type { Game } from '../domain/types'

export const SCHEMA_VERSION = 2 as const

/** A game as stored. `undo[0]` is the most recent undo step. */
export interface SavedGame {
  schemaVersion: typeof SCHEMA_VERSION
  game: Game
  undo: Game[]
  redo: Game[]
}

export interface SaveIndexEntry {
  id: string
  name: string
  updatedAt: string
  playerNames: string[]
}

export class ImportError extends Error {}

const INDEX_KEY = 'lostAtlas.index'
const CURRENT_KEY = 'lostAtlas.current'
const gameKey = (id: string) => `lostAtlas.game.${id}`

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * Migration hook. MIGRATIONS[n] turns a version n game into a version n + 1 game.
 */
const MIGRATIONS: Record<number, (game: unknown) => unknown> = {
  1: migrateV1,
}

/**
 * Version 1 to 2 (Phase 2). Adds treasury cash, the ledger, round state and the live flag.
 * Phase 1 games stay manual (`live: false`). A company that is on the track is assumed to
 * have operated already (decision D6), so its shares can be sold.
 */
function migrateV1(game: unknown): unknown {
  if (!isObject(game)) return game
  const companies = isObject(game.companies)
    ? Object.fromEntries(
        Object.entries(game.companies).map(([id, c]) => [
          id,
          isObject(c) ? { ...c, treasuryCash: 0, operated: c.status === 'active', ledger: [] } : c,
        ]),
      )
    : game.companies
  return {
    ...game,
    schemaVersion: 2,
    settings: isObject(game.settings) ? { ...game.settings, live: false } : game.settings,
    companies,
    round: { cycle: 1, type: 'SR' },
    cycleScores: [],
    soldThisRound: {},
    operating: { acted: [], issuedOrRedeemed: [] },
  }
}

function migrate(schemaVersion: unknown, game: unknown): unknown {
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 1) {
    throw new ImportError('This file is not a Lost Atlas Tracker export.')
  }
  if (schemaVersion > SCHEMA_VERSION) {
    throw new ImportError(
      `This file uses save format version ${schemaVersion}. This app reads up to version ${SCHEMA_VERSION}. Update the app and try again.`,
    )
  }
  let current = game
  for (let v = schemaVersion; v < SCHEMA_VERSION; v++) current = MIGRATIONS[v](current)
  return current
}

const PHASES = ['yellow', 'green', 'purple']
const VIEWS = ['track', 'ownership', 'scoreboard', 'dividend']
const STATUSES = ['unavailable', 'unstarted', 'active', 'merged', 'closed']

/** A share count the views can draw: a whole number from 0 to MAX_COUNT. */
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= MAX_COUNT

/** Checks the shape of a game. Returns the first missing or invalid field, or null. */
export function checkGame(g: unknown): string | null {
  if (!isObject(g)) return 'game'
  for (const key of ['id', 'name', 'createdAt']) if (typeof g[key] !== 'string') return key

  const settings = g.settings
  if (!isObject(settings) || typeof settings.shortGame !== 'boolean') return 'settings.shortGame'
  if (!PHASES.includes(settings.phase as string)) return 'settings.phase'
  if (!VIEWS.includes(settings.mainView as string)) return 'settings.mainView'

  const players = g.players
  if (!Array.isArray(players) || players.length < 2 || players.length > 5) return 'players'
  const playerIds = new Set<string>()
  for (const p of players) {
    if (!isObject(p) || typeof p.id !== 'string' || typeof p.name !== 'string' || typeof p.code !== 'string') return 'players'
    if (!isNumber(p.cash) || playerIds.has(p.id)) return 'players'
    playerIds.add(p.id)
  }

  const companies = g.companies
  if (!isObject(companies)) return 'companies'
  for (const id of COMPANY_IDS) {
    const c = companies[id]
    if (!isObject(c) || !STATUSES.includes(c.status as string)) return `companies.${id}`
    if (!(c.president === null || (typeof c.president === 'string' && playerIds.has(c.president)))) return `companies.${id}`
    if (!isObject(c.holdings) || !Object.values(c.holdings).every(isCount)) return `companies.${id}`
    if (!Object.keys(c.holdings).every((holder) => playerIds.has(holder))) return `companies.${id}`
    if (!isCount(c.treasuryShares) || !isCount(c.marketShares)) return `companies.${id}`
  }

  const track = g.track
  if (!Array.isArray(track) || track.length !== 27) return 'track'
  // Position 0 means closed. A token never rests there.
  if (Array.isArray(track[0]) && track[0].length > 0) return 'track'
  const onTrack = new Set<string>()
  for (const queue of track) {
    if (!Array.isArray(queue)) return 'track'
    for (const id of queue) {
      if (typeof id !== 'string' || !COMPANY_IDS.includes(id) || onTrack.has(id)) return 'track'
      onTrack.add(id)
    }
  }
  for (const id of COMPANY_IDS) {
    const active = (companies[id] as Record<string, unknown>).status === 'active'
    if (active !== onTrack.has(id)) return `companies.${id}.status`
  }
  return null
}

/** The text of an export file: `{ schemaVersion, game }`. */
export function exportGame(game: Game): string {
  return JSON.stringify({ schemaVersion: SCHEMA_VERSION, game }, null, 2)
}

export function exportFileName(game: Game): string {
  const slug = game.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `${slug || 'game'}.lost-atlas.json`
}

/** Parses an export file. Throws ImportError with a message for the user. */
export function importGame(text: string, existingIds: string[]): Game {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new ImportError('This file is not valid JSON.')
  }
  if (!isObject(data) || !('schemaVersion' in data) || !('game' in data)) {
    throw new ImportError('This file is not a Lost Atlas Tracker export.')
  }
  const migrated = migrate(data.schemaVersion, data.game)
  const problem = checkGame(migrated)
  if (problem !== null) throw new ImportError(`This file has a missing or invalid field: ${problem}.`)
  const game = migrated as Game
  return existingIds.includes(game.id) ? { ...game, id: newId() } : game
}

export function createSaves(storage: Storage = localStorage) {
  const index = useStorage<SaveIndexEntry[]>(INDEX_KEY, [], storage, {
    flush: 'sync',
    // Off: with it on, VueUse skips writes made in the same tick as a change it heard.
    // useGame() listens for changes from other tabs and calls refresh() instead.
    listenToStorageChanges: false,
    writeDefaults: false,
  })

  /**
   * The index as it is in storage now. Another tab may have changed it since this
   * one read it, so every change starts from this, not from the copy in memory.
   */
  function stored(): SaveIndexEntry[] {
    try {
      const data: unknown = JSON.parse(storage.getItem(INDEX_KEY) ?? '[]')
      if (!Array.isArray(data)) return []
      return data.filter((e): e is SaveIndexEntry => isObject(e) && typeof e.id === 'string' && typeof e.name === 'string')
    } catch {
      return []
    }
  }

  /** Shows the index as another tab left it. */
  function refresh() {
    index.value = stored()
  }

  /** Frees space: removes the undo and redo history of every saved game except `keepId`. */
  function dropOtherHistories(keepId: string): boolean {
    let freed = false
    for (const entry of stored()) {
      if (entry.id === keepId) continue
      try {
        const data: unknown = JSON.parse(storage.getItem(gameKey(entry.id)) ?? 'null')
        if (!isObject(data)) continue
        const has = (v: unknown) => Array.isArray(v) && v.length > 0
        if (!has(data.undo) && !has(data.redo)) continue
        storage.setItem(gameKey(entry.id), JSON.stringify({ ...data, undo: [], redo: [] }))
        freed = true
      } catch {
        // An unreadable entry is left as it is.
      }
    }
    return freed
  }

  function touch(game: Game) {
    const entry: SaveIndexEntry = {
      id: game.id,
      name: game.name,
      updatedAt: new Date().toISOString(),
      playerNames: game.players.map((p) => p.name),
    }
    index.value = [entry, ...stored().filter((e) => e.id !== game.id)]
  }

  /** Null for a missing entry and for one that cannot be read. */
  function read(id: string): SavedGame | null {
    try {
      const raw = storage.getItem(gameKey(id))
      if (raw === null) return null
      const data: unknown = JSON.parse(raw)
      if (!isObject(data)) return null
      const game = migrate(data.schemaVersion, data.game)
      if (checkGame(game) !== null) return null
      // History from an older schema version is dropped, not migrated.
      const sameVersion = data.schemaVersion === SCHEMA_VERSION
      const list = (v: unknown): Game[] =>
        sameVersion && Array.isArray(v) ? (v.filter((x) => checkGame(x) === null) as Game[]) : []
      return { schemaVersion: SCHEMA_VERSION, game: game as Game, undo: list(data.undo), redo: list(data.redo) }
    } catch {
      return null
    }
  }

  /**
   * Stores a game. When storage is full it first drops the history of the other saved
   * games. If that is not enough it drops this game's redo steps and the oldest half of
   * its undo steps, and tries again. `kept` is the number of undo steps that were stored.
   */
  function write(save: SavedGame): { ok: boolean; kept: number } {
    let undo = save.undo
    let redo = save.redo
    let othersDropped = false
    for (;;) {
      try {
        storage.setItem(gameKey(save.game.id), JSON.stringify({ ...save, undo, redo }))
        break
      } catch {
        if (!othersDropped) {
          othersDropped = true
          if (dropOtherHistories(save.game.id)) continue
        }
        if (undo.length === 0 && redo.length === 0) return { ok: false, kept: 0 }
        redo = []
        undo = undo.slice(0, Math.floor(undo.length / 2))
      }
    }
    touch(save.game)
    return { ok: true, kept: undo.length }
  }

  function getCurrent(): string | null {
    try {
      return storage.getItem(CURRENT_KEY)
    } catch {
      return null
    }
  }

  function setCurrent(id: string | null) {
    try {
      if (id === null) storage.removeItem(CURRENT_KEY)
      else storage.setItem(CURRENT_KEY, id)
    } catch {
      // The current game is a convenience. Losing it only changes the start screen.
    }
  }

  function remove(id: string) {
    storage.removeItem(gameKey(id))
    index.value = stored().filter((e) => e.id !== id)
    if (getCurrent() === id) setCurrent(null)
  }

  /** Copies a saved game without its history. Returns the new id, or null on failure. */
  function duplicate(id: string): string | null {
    const source = read(id)
    if (!source) return null
    const game: Game = { ...source.game, id: newId(), name: `${source.game.name} copy`, createdAt: new Date().toISOString() }
    return write({ schemaVersion: SCHEMA_VERSION, game, undo: [], redo: [] }).ok ? game.id : null
  }

  function rename(id: string, name: string) {
    const source = read(id)
    const trimmed = name.trim()
    if (!source || trimmed === '') return
    write({ ...source, game: { ...source.game, name: trimmed } })
  }

  /** Imports an export file as a new saved game. Throws ImportError. */
  function importText(text: string): Game {
    const game = importGame(text, index.value.map((e) => e.id))
    if (!write({ schemaVersion: SCHEMA_VERSION, game, undo: [], redo: [] }).ok) {
      throw new ImportError('Storage is full. Delete a saved game and try again.')
    }
    return game
  }

  /** The game id for a storage key of a saved game, or null for any other key. */
  const idOfKey = (key: string | null) => (key !== null && key.startsWith(gameKey('')) ? key.slice(gameKey('').length) : null)

  return { index, read, write, remove, duplicate, rename, importText, getCurrent, setCurrent, idOfKey, refresh, indexKey: INDEX_KEY }
}

export type Saves = ReturnType<typeof createSaves>

let shared: Saves | undefined

/** The app's saved games, on localStorage. */
export function useSaves(): Saves {
  return (shared ??= createSaves())
}

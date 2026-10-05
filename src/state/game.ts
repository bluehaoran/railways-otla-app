import { ref, watch } from 'vue'
import { useRefHistory } from '@vueuse/core'
import { useSaves, type SavedGame, type Saves } from './saves'
import type { Game } from '../domain/types'

const HISTORY_CAP = 200

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

/**
 * The one owner of the current game.
 * Every change goes through `commit`, which assigns a whole new Game in one synchronous
 * step, so each user action is exactly one history entry.
 */
export function createGameStore(saves: Saves) {
  const game = ref<Game | null>(null)
  // flush: 'sync' records each assignment at once, so two commits never merge into one entry.
  const history = useRefHistory(game, { deep: true, capacity: HISTORY_CAP, flush: 'sync' })
  const saveWarning = ref<string | null>(null)
  let quiet = false

  type Record = (typeof history.undoStack.value)[number]
  const snapshots = (stack: Record[]): Game[] => stack.map((r) => r.snapshot).filter((s): s is Game => s !== null)
  const records = (games: Game[]): Record[] => games.map((g) => ({ snapshot: clone(g), timestamp: Date.now() }))

  function persist() {
    const current = game.value
    if (quiet || current === null) return
    const undo = snapshots(history.undoStack.value)
    const result = saves.write({
      schemaVersion: 1,
      game: clone(current),
      undo,
      redo: snapshots(history.redoStack.value),
    })
    if (!result.ok) {
      saveWarning.value = 'Storage is full. This game is not being saved. Delete old saved games to free space, or export this game from the menu.'
    } else if (result.kept < undo.length) {
      // Storage kept only the newest undo steps. Drop the same steps here so the next save fits.
      history.undoStack.value = history.undoStack.value.slice(0, result.kept)
      history.redoStack.value = []
      saveWarning.value = 'Storage is full. Older undo steps were dropped. Delete old saved games to free space.'
    }
  }

  // Registered after useRefHistory, so the history stacks are up to date when this runs.
  watch(game, persist, { deep: true, flush: 'sync' })

  function load(next: Game | null, undo: Game[], redo: Game[]) {
    quiet = true
    game.value = next === null ? null : clone(next)
    history.undoStack.value = records(undo)
    history.redoStack.value = records(redo)
    quiet = false
  }

  function commit(next: Game) {
    const copy = clone(next)
    // An input that reports its unchanged value on blur must not add an undo step.
    if (JSON.stringify(copy) === JSON.stringify(game.value)) return
    game.value = copy
  }

  function open(save: SavedGame) {
    load(save.game, save.undo.slice(0, HISTORY_CAP), save.redo)
    saves.setCurrent(save.game.id)
  }

  function create(next: Game) {
    load(next, [], [])
    saves.setCurrent(next.id)
    persist()
  }

  function resume(): boolean {
    const id = saves.getCurrent()
    const save = id === null ? null : saves.read(id)
    if (!save) return false
    open(save)
    return true
  }

  function close() {
    load(null, [], [])
    saves.setCurrent(null)
  }

  /**
   * Another tab changed storage key `key`. If it is the open game, show that tab's
   * version here, so the two tabs do not overwrite each other's changes.
   */
  function externalChange(key: string | null) {
    const current = game.value
    if (current === null || saves.idOfKey(key) !== current.id) return
    const save = saves.read(current.id)
    if (!save) return
    load(save.game, save.undo.slice(0, HISTORY_CAP), save.redo)
    saveWarning.value = 'This game was changed in another tab. The latest version is now shown.'
  }

  return {
    game,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undo: () => history.undo(),
    redo: () => history.redo(),
    commit,
    create,
    open,
    resume,
    close,
    externalChange,
    saveWarning,
  }
}

export type GameStore = ReturnType<typeof createGameStore>

let shared: GameStore | undefined

/** The app's game store. */
export function useGame(): GameStore {
  if (!shared) {
    const saves = useSaves()
    const store = createGameStore(saves)
    // The browser sends this event to the other tabs when one tab writes to localStorage.
    window.addEventListener('storage', (event) => {
      if (event.storageArea !== localStorage) return
      if (event.key === saves.indexKey) saves.refresh()
      else store.externalChange(event.key)
    })
    shared = store
  }
  return shared
}

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import { COMPANIES, SHORT_GAME_REMOVED } from '../domain/companies'
import { PHASE_LABEL } from '../domain/format'
import { codeProblems, playerCodes } from '../domain/playerCodes'
import { MAX_PLAYERS, MIN_PLAYERS, STARTING_CASH, defaultShortGame, newGame } from '../domain/setup'
import { PHASE_MAX } from '../domain/track'
import type { Game, Phase } from '../domain/types'

// Same breakpoint as the CSS below. The code field is two characters wide on a phone.
const narrow = useMediaQuery('(max-width: 719px)')
const cashPt = { pcInputText: { root: { maxlength: 3 } } }

const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ start: [game: Game] }>()

interface Row {
  key: number
  name: string
  code: string
  codeEdited: boolean
  cash: number
  cashEdited: boolean
}

let nextKey = 0
const blankRow = (): Row => ({ key: nextKey++, name: '', code: '', codeEdited: false, cash: 0, cashEdited: false })

const gameName = ref('')
const rows = ref<Row[]>([])
const shortGame = ref(true)
const lengthPicked = ref(false)
const phase = ref<Phase>('yellow')

const lengthOptions = [
  { label: 'Short · 4 cycles', value: true },
  { label: 'Long · 6 cycles', value: false },
]
const phaseOptions = (['yellow', 'green', 'purple'] as Phase[]).map((value) => ({
  value,
  label: PHASE_LABEL[value],
  range: `60–${PHASE_MAX[value]}`,
}))

/** Applies the defaults that follow the names and the player count. */
function refresh() {
  const count = rows.value.length
  const auto = playerCodes(rows.value.map((r) => r.name))
  rows.value.forEach((row, i) => {
    if (!row.codeEdited) row.code = auto[i]
    if (!row.cashEdited) row.cash = STARTING_CASH[count]
  })
  if (!lengthPicked.value) shortGame.value = defaultShortGame(count)
}

function reset() {
  gameName.value = `Game ${new Date().toLocaleDateString()}`
  rows.value = [blankRow(), blankRow()]
  lengthPicked.value = false
  phase.value = 'yellow'
  refresh()
}

watch(visible, (open) => open && reset(), { immediate: true })

function addPlayer() {
  if (rows.value.length >= MAX_PLAYERS) return
  rows.value.push(blankRow())
  refresh()
}

function removePlayer(index: number) {
  if (rows.value.length <= MIN_PLAYERS) return
  rows.value.splice(index, 1)
  refresh()
}

function setName(row: Row, name: string | undefined) {
  row.name = name ?? ''
  refresh()
}

function setCode(row: Row, code: string | undefined) {
  row.code = code ?? ''
  row.codeEdited = true
}

function setCash(row: Row, cash: number | null) {
  const next = cash ?? 0
  // The number input also reports its value on blur. Only a changed value is an edit.
  if (next === row.cash) return
  row.cash = next
  row.cashEdited = true
}

function pickLength(value: boolean) {
  shortGame.value = value
  lengthPicked.value = true
}

const problems = computed(() => codeProblems(rows.value.map((r) => r.code)))
const valid = computed(
  () => rows.value.every((r) => r.name.trim() !== '') && problems.value.every((p) => p === null),
)
const summary = computed(() => {
  const count = rows.value.length
  return `${count} players, ${STARTING_CASH[count]} each. Codes come from the names and can be edited.`
})
const removed = SHORT_GAME_REMOVED.map((id) => COMPANIES[id])

function start() {
  if (!valid.value) return
  emit(
    'start',
    newGame({
      name: gameName.value.trim() || 'Untitled game',
      players: rows.value.map((r) => ({ name: r.name.trim(), code: r.code.trim(), cash: r.cash })),
      shortGame: shortGame.value,
      phase: phase.value,
      live: false, // Plan 3 replaces this with a Setup toggle
    }),
  )
  visible.value = false
}
</script>

<template>
  <Dialog v-model:visible="visible" modal header="New game" :style="{ width: 'min(560px, 100vw)' }">
    <div class="dialog-body">
      <label class="field">
        <span class="field-label">Game name</span>
        <InputText v-model="gameName" data-testid="game-name" fluid />
      </label>

      <div class="field">
        <div class="player-row field-label">
          <span class="name">Players, in seating order</span>
          <span class="code">Code</span>
          <span class="cash"><span class="wide">Starting cash</span><span class="narrow">Cash</span></span>
          <span class="remove" />
        </div>
        <div v-for="(row, i) in rows" :key="row.key">
          <div class="player-row">
            <InputText
              class="name"
              :model-value="row.name"
              :placeholder="`Player ${i + 1}`"
              :aria-label="`Player ${i + 1} name`"
              data-testid="player-name"
              @update:model-value="(v) => setName(row, v)"
            />
            <InputText
              class="code mono"
              :model-value="row.code"
              :invalid="problems[i] !== null"
              :aria-label="`Player ${i + 1} code`"
              :maxlength="narrow ? 2 : 6"
              data-testid="player-code"
              @update:model-value="(v) => setCode(row, v)"
            />
            <InputNumber
              class="cash"
              :model-value="row.cash"
              :min="0"
              :aria-label="`Player ${i + 1} starting cash`"
              input-class="mono cash-input"
              :pt="cashPt"
              @update:model-value="(v) => setCash(row, v)"
            />
            <button
              type="button"
              class="icon-btn remove"
              aria-label="Remove player"
              :disabled="rows.length <= MIN_PLAYERS"
              @click="removePlayer(i)"
            >
              <i class="pi pi-trash" aria-hidden="true" />
            </button>
          </div>
          <div v-if="problems[i] !== null && row.name.trim() !== ''" class="error-text">{{ problems[i] }}</div>
        </div>
        <div class="under">
          <Button
            label="Add player"
            icon="pi pi-plus"
            text
            :disabled="rows.length >= MAX_PLAYERS"
            data-testid="add-player"
            @click="addPlayer"
          />
          <span class="small muted">{{ summary }}</span>
        </div>
      </div>

      <div class="field">
        <span class="field-label">Game length</span>
        <SelectButton
          :model-value="shortGame"
          :options="lengthOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          fluid
          @update:model-value="pickLength"
        />
        <span class="small muted">2 players default to short. 3 to 5 players default to long.</span>
        <div class="removed small muted">
          {{ shortGame ? 'A short game removes:' : 'A long game includes:' }}
          <span v-for="m in removed" :key="m.id" class="pill" :class="{ struck: shortGame }">
            <span class="dot" :style="{ background: m.color }" />{{ m.names[0] }}
          </span>
        </div>
      </div>

      <div class="field">
        <span class="field-label">Current phase, limits the start price of new companies</span>
        <SelectButton v-model="phase" :options="phaseOptions" option-label="label" option-value="value" :allow-empty="false" fluid>
          <template #option="{ option }">
            <span class="phase-option">
              <span><span class="swatch" :class="`zone-${option.value}`" />{{ option.label }}</span>
              <span class="mono small">{{ option.range }}</span>
            </span>
          </template>
        </SelectButton>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button label="Cancel" severity="secondary" outlined @click="visible = false" />
        <Button label="Start game" :disabled="!valid" data-testid="start-game" @click="start" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.narrow {
  display: none;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.player-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.player-row .name {
  flex: 1;
  min-width: 0;
}
.player-row .code {
  width: 72px;
  text-align: center;
}
.player-row .cash {
  width: 104px;
}
.player-row .remove {
  width: 44px;
  border: 0;
  background: transparent;
}
.player-row :deep(.cash-input) {
  width: 104px;
  text-align: right;
}
@media (max-width: 719px) {
  .wide {
    display: none;
  }
  .narrow {
    display: inline;
  }
  .player-row {
    gap: 4px;
  }
  .player-row .name {
    flex: 1;
    min-width: 0;
  }
  .player-row .code {
    flex: none;
    width: 2.75rem;
  }
  .player-row :deep(.code),
  .player-row :deep(.cash-input) {
    padding-left: 4px;
    padding-right: 4px;
  }
  .player-row .cash,
  .player-row :deep(.cash-input) {
    flex: none;
    width: 3.5rem;
  }
  .player-row .remove {
    flex: none;
    width: 2rem;
    height: 2rem;
  }
}
.under {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.removed {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--line-2);
  border-radius: 12px;
}
.pill.struck {
  text-decoration: line-through;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid rgba(24, 24, 27, 0.45);
}
.phase-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 18px;
}
.swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-right: 6px;
  border-radius: 3px;
  border: 1px solid rgba(24, 24, 27, 0.45);
  vertical-align: -1px;
}
</style>

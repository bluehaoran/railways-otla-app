<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import { canChangeShortGame, renameGame, setMainView, setPhase, setShortGame } from '../domain/edit'
import { PHASE_LABEL } from '../domain/format'
import { PHASE_MAX } from '../domain/track'
import type { Game, Phase, ViewId } from '../domain/types'

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ game: Game; editMode: boolean }>()
const emit = defineEmits<{ update: [game: Game] }>()

const name = ref(props.game.name)
watch(
  () => [visible.value, props.game.name],
  () => {
    name.value = props.game.name
  },
)

const phaseOptions = (['yellow', 'green', 'purple'] as Phase[]).map((value) => ({
  value,
  label: `${PHASE_LABEL[value]} 60–${PHASE_MAX[value]}`,
}))
const viewOptions: { label: string; value: ViewId }[] = [
  { label: 'Track', value: 'track' },
  { label: 'Ownership', value: 'ownership' },
  { label: 'Scoreboard', value: 'scoreboard' },
]
const lengthOptions = [
  { label: 'Short · 4 cycles', value: true },
  { label: 'Long · 6 cycles', value: false },
]

const lengthOpen = computed(() => canChangeShortGame(props.game))
const lengthHelp = computed(() => {
  if (!lengthOpen.value) return 'The game length is fixed once a company has started.'
  if (!props.editMode) return 'Turn on edit mode to change the game length.'
  return 'A short game removes Adaptive, Overnight, Bridging and Spacious.'
})

/** Commits the name on blur or Enter, so a rename is one undo step. */
function commitName() {
  const trimmed = name.value.trim()
  if (trimmed === '' || trimmed === props.game.name) {
    name.value = props.game.name
    return
  }
  emit('update', renameGame(props.game, trimmed))
}
</script>

<template>
  <Dialog v-model:visible="visible" modal header="Settings" :style="{ width: 'min(520px, 100vw)' }">
    <div class="dialog-body">
      <label class="field">
        <span class="field-label">Game name</span>
        <InputText v-model="name" fluid data-testid="settings-name" @blur="commitName" @keydown.enter="commitName" />
      </label>

      <div class="field">
        <span class="field-label">Current phase, limits the start price of new companies</span>
        <SelectButton
          :model-value="game.settings.phase"
          :options="phaseOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          fluid
          @update:model-value="(v: Phase) => emit('update', setPhase(game, v))"
        />
      </div>

      <div class="field">
        <span class="field-label">View shown when this game opens</span>
        <SelectButton
          :model-value="game.settings.mainView"
          :options="viewOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          fluid
          @update:model-value="(v: ViewId) => emit('update', setMainView(game, v))"
        />
      </div>

      <div class="field">
        <span class="field-label">Game length</span>
        <SelectButton
          :model-value="game.settings.shortGame"
          :options="lengthOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          :disabled="!editMode || !lengthOpen"
          fluid
          @update:model-value="(v: boolean) => emit('update', setShortGame(game, v))"
        />
        <span class="small muted">{{ lengthHelp }}</span>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button label="Done" @click="visible = false" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>

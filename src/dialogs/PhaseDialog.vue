<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import SelectButton from 'primevue/selectbutton'
import { setPhase } from '../domain/edit'
import { PHASE_LABEL } from '../domain/format'
import { PHASE_MAX } from '../domain/track'
import type { Game, Phase } from '../domain/types'

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ game: Game; exportStep: boolean }>()
const emit = defineEmits<{ update: [game: Game] }>()

const options = (['yellow', 'green', 'purple'] as Phase[]).map((value) => ({
  value,
  label: `${PHASE_LABEL[value]} 60–${PHASE_MAX[value]}`,
}))
const header = computed(() => (props.exportStep ? 'Export a train' : 'Phase'))
const text = computed(() =>
  props.exportStep
    ? `Cycle ${props.game.round.cycle - 1} is over. Take the top train off the available stack. If that train changes the phase, set it here. A phase change now does not add a Merger Round to the cycle that just ended.`
    : 'The phase limits the start price of new companies and turns the Merger Round on from green.',
)
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="header" :style="{ width: 'min(520px, 100vw)' }">
    <div class="dialog-body">
      <p class="text">{{ text }}</p>
      <div class="field">
        <span class="field-label">Current phase</span>
        <SelectButton
          :model-value="game.settings.phase"
          :options="options"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          fluid
          @update:model-value="(v: Phase) => emit('update', setPhase(game, v))"
        />
      </div>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <Button label="Done" data-testid="phase-done" @click="visible = false" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.text {
  margin: 0;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>

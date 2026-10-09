<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import CompanyTag from '../components/CompanyTag.vue'
import { displayName } from '../domain/companies'
import { endStockRound, stockRoundRisers } from '../domain/rounds'
import { TOP, TRACK, findToken } from '../domain/track'
import type { CompanyId, Game } from '../domain/types'

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ game: Game }>()
const emit = defineEmits<{ update: [game: Game] }>()

/** Companies the user took out of the bonus. */
const skipped = ref<Set<CompanyId>>(new Set())
watch(visible, (open) => open && (skipped.value = new Set()), { immediate: true })

const rows = computed(() =>
  stockRoundRisers(props.game).map((id) => {
    const pos = findToken(props.game, id)!
    return {
      id,
      name: displayName(props.game.companies[id]),
      from: TRACK[pos.index],
      to: TRACK[Math.min(TOP, pos.index + 1)],
    }
  }),
)

function toggle(id: CompanyId, on: boolean) {
  const next = new Set(skipped.value)
  if (on) next.delete(id)
  else next.add(id)
  skipped.value = next
}

function confirm() {
  emit('update', endStockRound(props.game, [...skipped.value]))
  visible.value = false
}
</script>

<template>
  <Dialog v-model:visible="visible" modal header="End Stock Round" :style="{ width: 'min(520px, 100vw)' }">
    <div class="dialog-body">
      <p v-if="rows.length === 0" class="text">No company is fully owned by players, so no price changes.</p>
      <template v-else>
        <p class="text">
          A company whose shares are all held by players rises one step. Move each token up one step and put it
          at the back of its new column.
        </p>
        <ul class="list">
          <li v-for="r in rows" :key="r.id" class="row">
            <Checkbox
              :model-value="!skipped.has(r.id)"
              binary
              :input-id="`riser-${r.id}`"
              :data-testid="`riser-${r.id}`"
              :aria-label="`Raise ${r.name}`"
              @update:model-value="(v: boolean) => toggle(r.id, v)"
            />
            <CompanyTag :company-id="r.id" />
            <span class="name">{{ r.name }}</span>
            <span class="mono prices">{{ r.from }} → {{ r.to }}</span>
          </li>
        </ul>
      </template>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <Button label="Cancel" severity="secondary" outlined @click="visible = false" />
        <Button label="End Stock Round" data-testid="end-sr-confirm" @click="confirm" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.text {
  margin: 0;
}
.list {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--line-2);
  border-radius: 12px;
  overflow: hidden;
}
.row {
  min-height: 52px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 12px;
  border-top: 1px solid var(--line);
}
.row:first-child {
  border-top: 0;
}
.name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
}
.prices {
  white-space: nowrap;
}
</style>

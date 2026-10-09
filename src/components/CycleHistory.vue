<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import PlayerCode from './PlayerCode.vue'
import { cycleHistory } from '../domain/history'
import { saveSnapshot } from '../domain/rounds'
import type { Game } from '../domain/types'

const props = defineProps<{ game: Game }>()
const emit = defineEmits<{ update: [game: Game] }>()

const columns = computed(() => cycleHistory(props.game))
const rows = computed(() =>
  props.game.players.map((player) => ({
    player,
    cells: columns.value.map((c) => c.rows.find((r) => r.playerId === player.id)!),
  })),
)

function change(value: number | null): string {
  if (value === null) return '–'
  return value >= 0 ? `+${value}` : `−${Math.abs(value)}`
}
</script>

<template>
  <section class="history" data-testid="cycle-history" :style="{ '--cols': columns.length }">
    <p v-if="columns.length === 0" class="muted empty">
      No cycle has finished yet. A snapshot is saved when each cycle ends.
    </p>
    <div v-else class="card table">
      <div class="row head">
        <div class="label small strong">Player</div>
        <div v-for="c in columns" :key="c.cycle" class="cell strong">Cycle {{ c.cycle }}</div>
      </div>
      <div v-for="r in rows" :key="r.player.id" class="row">
        <div class="label">
          <PlayerCode :code="r.player.code" />
          <span class="name">{{ r.player.name }}</span>
        </div>
        <div v-for="(cell, i) in r.cells" :key="columns[i].cycle" class="cell">
          <template v-if="cell.total !== null">
            <span class="mono total">{{ cell.total }}</span>
            <span class="small muted">#{{ cell.rank }} · {{ change(cell.change) }}</span>
          </template>
          <span v-else class="mono none">–</span>
        </div>
      </div>
    </div>
    <p v-if="columns.length > 0" class="small muted">
      The first cycle has no change: the starting cash is not stored.
    </p>
    <div>
      <Button
        label="Save snapshot now"
        icon="pi pi-camera"
        severity="secondary"
        outlined
        data-testid="save-snapshot"
        @click="emit('update', saveSnapshot(game))"
      />
    </div>
  </section>
</template>

<style scoped>
.history {
  --label: 180px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.empty {
  margin: 0;
}
.strong {
  font-weight: 600;
}
.row {
  display: grid;
  grid-template-columns: var(--label) repeat(var(--cols), minmax(88px, 1fr));
  min-height: 56px;
  border-top: 1px solid var(--line);
}
.row.head {
  min-height: 44px;
  border-top: 0;
  background: var(--head);
}
.label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  min-width: 0;
}
.name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cell {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  padding: 4px 12px;
}
.row.head .cell {
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
}
.total {
  font-size: 18px;
}
.none {
  color: var(--faint);
}
.table {
  overflow-x: auto;
}
@media (max-width: 719px) {
  .history {
    --label: 72px;
  }
  .name {
    display: none;
  }
  .label,
  .cell {
    padding: 4px 6px;
  }
}
</style>

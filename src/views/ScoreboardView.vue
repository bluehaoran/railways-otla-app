<script setup lang="ts">
import { computed, ref } from 'vue'
import InputNumber from 'primevue/inputnumber'
import SelectButton from 'primevue/selectbutton'
import CycleHistory from '../components/CycleHistory.vue'
import CompanyTag from '../components/CompanyTag.vue'
import PlayerCode from '../components/PlayerCode.vue'
import { displayName } from '../domain/companies'
import { setCash } from '../domain/edit'
import { ranking, tieNotes, turnOrder } from '../domain/scoring'
import { isGameOver } from '../domain/rounds'
import { shares, validate } from '../domain/shares'
import { priceOf } from '../domain/track'
import type { Game, PlayerId } from '../domain/types'

const props = defineProps<{ game: Game }>()
const emit = defineEmits<{ update: [game: Game] }>()

const ranks = computed(() => ranking(props.game))
const notes = computed(() => tieNotes(props.game))
const leaders = computed(() => new Set(ranks.value.filter((r) => r.rank === 1).map((r) => r.playerId)))
const totals = computed(() => new Map(ranks.value.map((r) => [r.playerId, r.total])))
const negative = computed(
  () => new Set(validate(props.game).filter((w) => w.code === 'negative-cash').map((w) => w.playerId)),
)

const cards = computed(() =>
  ranks.value.map((r, i) => {
    const player = props.game.players.find((p) => p.id === r.playerId)!
    const next = ranks.value[i + 1]
    let note = player.name
    if (r.rank === 1) note = leaders.value.size > 1 ? 'Tied for the lead' : 'Leader'
    // A player who is ahead of another player with the same total won the tie-break.
    if (r.tieBreakApplied && next && next.total === r.total && next.rank !== r.rank) {
      note = r.rank === 1 ? 'Leader, won the tie-break' : 'Won the tie-break'
    }
    return { ...r, player, note }
  }),
)

const companyRows = computed(() =>
  turnOrder(props.game).map((id) => {
    const company = props.game.companies[id]
    const price = priceOf(props.game, id) ?? 0
    return {
      id,
      name: displayName(company),
      price,
      cells: props.game.players.map((p) => ({ playerId: p.id, count: shares(company, p.id) })),
    }
  }),
)

const mode = ref<'now' | 'cycles'>('now')
const modeOptions = [
  { label: 'Now', value: 'now' },
  { label: 'By cycle', value: 'cycles' },
]
const over = computed(() => isGameOver(props.game))
const winner = computed(() => cards.value[0])

const lead = (id: PlayerId) => ({ lead: leaders.value.has(id) })
</script>

<template>
  <section class="scoreboard" :style="{ '--players': game.players.length }">
    <SelectButton
      v-if="game.settings.live"
      v-model="mode"
      class="mode"
      :options="modeOptions"
      option-label="label"
      option-value="value"
      :allow-empty="false"
      aria-label="Scoreboard view"
      data-testid="scoreboard-mode"
    />
    <p v-if="over" class="note final-banner" data-testid="final-banner">
      <i class="pi pi-flag" aria-hidden="true" />
      <span>
        Final ranking. {{ winner.player.name }} wins with {{ winner.total }}.
      </span>
    </p>
    <CycleHistory v-if="mode === 'cycles' && game.settings.live" :game="game" @update="(g) => emit('update', g)" />

    <template v-if="mode === 'now' || !game.settings.live">
    <div class="ranked">
      <div
        v-for="c in cards"
        :key="c.playerId"
        class="rank-card"
        :class="{ lead: c.rank === 1 }"
        :data-rank-card="c.playerId"
      >
        <span class="mono rank">{{ c.rank }}</span>
        <PlayerCode :code="c.player.code" :size="36" />
        <div class="rank-text">
          <div class="mono rank-total">{{ c.total }}</div>
          <div class="small note-text">{{ c.note }}</div>
        </div>
      </div>
    </div>

    <div class="table card">
      <div class="row head">
        <div class="label small strong">Seating order</div>
        <div v-for="p in game.players" :key="p.id" class="cell player-head" :class="lead(p.id)">
          <span class="small muted player-name">{{ p.name }}</span>
          <PlayerCode :code="p.code" />
        </div>
      </div>

      <div class="row cash" data-row="cash">
        <div class="label">
          <div class="strong">Cash</div>
          <div class="small muted hint">Tap a value to edit</div>
        </div>
        <div v-for="p in game.players" :key="p.id" class="cell" :class="lead(p.id)" :data-player="p.id">
          <InputNumber
            :model-value="p.cash"
            :use-grouping="false"
            :aria-label="`Cash of ${p.name}`"
            input-class="mono cash-input"
            @update:model-value="(v) => emit('update', setCash(game, p.id, v))"
          />
          <span v-if="negative.has(p.id)" class="small negative">Negative</span>
        </div>
      </div>

      <div v-for="r in companyRows" :key="r.id" class="row" :data-row="r.id">
        <div class="label company">
          <CompanyTag :company-id="r.id" />
          <span class="strong company-name">{{ r.name }}</span>
          <span class="mono small muted">@{{ r.price }}</span>
        </div>
        <div v-for="c in r.cells" :key="c.playerId" class="cell" :class="lead(c.playerId)" :data-player="c.playerId">
          <template v-if="c.count > 0">
            <span class="mono value">{{ c.count * r.price }}</span>
            <span class="mono small muted sub">{{ c.count }} × {{ r.price }}</span>
          </template>
          <span v-else class="mono value none">–</span>
        </div>
      </div>

      <div class="row total" data-row="total">
        <div class="label strong">Total value</div>
        <div v-for="p in game.players" :key="p.id" class="cell" :class="lead(p.id)" :data-player="p.id">
          <span class="mono total-value">{{ totals.get(p.id) }}</span>
        </div>
      </div>
    </div>

    <p v-for="note in notes" :key="note" class="note tie-note">
      <i class="pi pi-info-circle" aria-hidden="true" />
      <span>{{ note }}</span>
    </p>
    </template>
  </section>
</template>

<style scoped>
.scoreboard {
  --label: 220px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 16px 16px;
}
.strong {
  font-weight: 600;
}
.ranked {
  display: grid;
  grid-template-columns: repeat(var(--players), minmax(0, 1fr));
  gap: 12px;
}
.rank-card {
  min-height: 84px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border: 1px solid var(--line-2);
  border-radius: 12px;
  background: var(--card);
}
.rank-card.lead {
  border: 2px solid var(--primary);
  background: var(--lead);
}
.rank {
  width: 22px;
  font-size: 28px;
  line-height: 32px;
}
.rank-text {
  min-width: 0;
}
.rank-total {
  font-size: 24px;
  line-height: 28px;
}
.note-text {
  color: var(--ink-2);
}
.row {
  display: grid;
  grid-template-columns: var(--label) repeat(var(--players), minmax(0, 1fr));
  align-items: stretch;
  min-height: 52px;
  border-top: 1px solid var(--line);
}
.row.head {
  min-height: 56px;
  border-top: 0;
  background: var(--head);
}
.row.cash,
.row.total {
  min-height: 60px;
}
.row.total {
  border-top: 2px solid var(--ink);
}
.label {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 16px;
}
.label.company {
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  gap: 10px;
}
.company-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.head .label {
  color: var(--muted);
}
.cell {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  padding: 4px 16px;
}
.cell.lead {
  background: var(--lead);
}
.player-head {
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
.cell :deep(.cash-input) {
  width: 112px;
  max-width: 100%;
  min-height: 44px;
  text-align: right;
  font-size: 16px;
}
.negative {
  color: var(--amber-ink);
  font-weight: 600;
}
.value {
  font-size: 18px;
  line-height: 22px;
}
.sub {
  line-height: 14px;
  font-weight: 500;
}
.none {
  color: var(--faint);
}
.total-value {
  font-size: 24px;
}
.final-banner {
  margin: 0;
  background: var(--lead);
  border: 2px solid var(--primary);
  font-weight: 600;
}
.mode :deep(button) {
  min-height: 44px;
}
.tie-note {
  margin: 0;
  background: var(--card);
  border: 1px solid var(--line-2);
  font-size: 14px;
  line-height: 20px;
}

@media (max-width: 719px) {
  .scoreboard {
    --label: 84px;
    gap: 8px;
    padding: 8px;
  }
  .ranked {
    grid-template-columns: 1fr;
    gap: 0;
    border: 1px solid var(--line-2);
    border-radius: 12px;
    overflow: hidden;
  }
  .rank-card,
  .rank-card.lead {
    min-height: 40px;
    padding: 2px 12px;
    border: 0;
    border-top: 1px solid var(--bg);
    border-radius: 0;
  }
  .rank {
    width: 18px;
    font-size: 16px;
  }
  .rank-text {
    flex: 1;
    display: flex;
    flex-direction: row-reverse;
    align-items: center;
    justify-content: space-between;
  }
  .rank-total {
    font-size: 16px;
  }
  .label,
  .cell {
    padding: 4px 6px;
  }
  .label.company {
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 2px;
  }
  .company-name,
  .player-name,
  .hint {
    display: none;
  }
  .player-head {
    justify-content: center;
  }
  .cell :deep(.cash-input) {
    width: 100%;
    padding: 0 6px;
    font-size: 14px;
  }
  .value {
    font-size: 15px;
    line-height: 20px;
  }
  .total-value {
    font-size: 16px;
  }
}
</style>

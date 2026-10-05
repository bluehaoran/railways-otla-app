<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import ToggleSwitch from 'primevue/toggleswitch'
import { useConfirm } from 'primevue/useconfirm'
import CompanyTag from '../components/CompanyTag.vue'
import TokenChip from '../components/TokenChip.vue'
import TrackQueue from '../components/TrackQueue.vue'
import { closeCompany } from '../domain/company'
import { displayName } from '../domain/companies'
import { ZONE_LABEL, ordinal } from '../domain/format'
import { turnOrder } from '../domain/scoring'
import { TOP, TRACK, findToken, moveToken, placeToken, zoneOf, type MoveResult } from '../domain/track'
import type { CompanyId, Game } from '../domain/types'

const props = defineProps<{ game: Game; editMode: boolean }>()
const emit = defineEmits<{ update: [game: Game] }>()
const confirm = useConfirm()

const showFull = ref(false)
const selectedId = ref<CompanyId | null>(null)
const priceDialog = ref(false)
/** Changes after every drag, to re-create the queues (see TrackQueue). */
const epoch = ref(0)

const order = computed(() => turnOrder(props.game))

// Same breakpoint as the CSS below. Wide: a row of columns. Narrow: a column of rows.
const wide = useMediaQuery('(min-width: 720px)')

/**
 * Track indices to show. On a wide screen the track runs left to right from the lowest
 * price to the highest, so turn order reads right to left. On a phone the highest price
 * is on top, so turn order reads top to bottom.
 */
const indices = computed(() => {
  let low = 5
  let high = 10
  const occupied = props.game.track.flatMap((queue, i) => (queue.length > 0 ? [i] : []))
  if (showFull.value) {
    low = 0
    high = TOP
  } else if (occupied.length > 0) {
    low = Math.max(0, Math.min(...occupied) - 1)
    high = Math.min(TOP, Math.max(...occupied) + 1)
  }
  const out: number[] = []
  for (let i = high; i >= low; i--) out.push(i)
  return wide.value ? out.reverse() : out
})

const codeOf = (id: CompanyId) => {
  const president = props.game.companies[id].president
  return props.game.players.find((p) => p.id === president)?.code ?? null
}
const nameOf = (id: CompanyId) => displayName(props.game.companies[id])
const tokenLabel = (id: CompanyId, index: number) =>
  `${nameOf(id)} at ${TRACK[index]}, president ${codeOf(id) ?? 'none'}`

const selected = computed(() => {
  const id = selectedId.value
  const pos = id === null ? null : findToken(props.game, id)
  if (id === null || pos === null) return null
  return {
    id,
    index: pos.index,
    price: TRACK[pos.index],
    name: nameOf(id),
    code: codeOf(id),
    acts: order.value.indexOf(id) + 1,
    up: pos.index < TOP ? { text: 'Up to', price: TRACK[pos.index + 1] } : { text: 'Stay at', price: TRACK[TOP] },
    down: { text: 'Down to', price: TRACK[pos.index - 1], note: pos.index > 1 ? '' : ', close' },
  }
})

watch(selected, (value) => {
  if (value === null) selectedId.value = null
})

function askClose(id: CompanyId) {
  const name = nameOf(id)
  confirm.require({
    header: `Close ${name}?`,
    message: `${name} reaches 0 and closes. All its shares leave the game. You can undo this.`,
    acceptProps: { label: 'Close company', severity: 'danger' },
    rejectProps: { label: 'Cancel', severity: 'secondary', outlined: true },
    accept: () => emit('update', closeCompany(props.game, id)),
  })
}

function apply(result: MoveResult) {
  if (result.kind === 'moved') emit('update', result.game)
  else askClose(result.companyId)
}

function step(steps: number) {
  if (selected.value) apply(moveToken(props.game, selected.value.id, steps))
}

function toSlot(slot?: number) {
  if (selected.value) apply(placeToken(props.game, selected.value.id, selected.value.index, slot))
}

function toPrice(index: number) {
  priceDialog.value = false
  if (selected.value) apply(placeToken(props.game, selected.value.id, index))
}

function onDrop(payload: { id: CompanyId; index: number; slot: number }) {
  selectedId.value = payload.id
  apply(placeToken(props.game, payload.id, payload.index, payload.slot))
  epoch.value++
}
</script>

<template>
  <section class="track-view">
    <div class="bar">
      <span class="hint">
        <i class="pi pi-arrow-left wide" aria-hidden="true" />
        <i class="pi pi-arrow-down narrow" aria-hidden="true" />
        <span class="wide">Turn order: highest price acts first, right to left</span>
        <span class="narrow">Top acts first</span>
      </span>
      <span class="grow" />
      <span class="small muted wide">Showing {{ indices.length }} of {{ TRACK.length }} positions</span>
      <label class="toggle" data-testid="full-track">
        <ToggleSwitch v-model="showFull" />
        <span>Show full track</span>
      </label>
    </div>

    <div :key="`${epoch}-${editMode}`" class="track card">
      <div
        v-for="i in indices"
        :key="i"
        class="pos"
        :class="{ occupied: game.track[i].length > 0 }"
        :data-price="TRACK[i]"
      >
        <div class="pos-head" :class="`zone-${zoneOf(TRACK[i])}`">
          <span class="mono price">{{ TRACK[i] }}</span>
          <span class="zone-name">{{ ZONE_LABEL[zoneOf(TRACK[i])] }}</span>
        </div>
        <TrackQueue :index="i" :edit-mode="editMode" @drop="onDrop">
          <TokenChip
            v-for="(id, slot) in game.track[i]"
            :key="id"
            :company-id="id"
            :president-code="codeOf(id)"
            :label="tokenLabel(id, i)"
            :rank="game.track[i].length > 1 ? slot + 1 : null"
            :selected="id === selectedId"
            @click="selectedId = id"
          />
        </TrackQueue>
      </div>
    </div>

    <p v-if="order.length === 0" class="empty muted">No company has started. Use Start company.</p>

    <div v-if="selected" class="dock" data-testid="dock">
      <CompanyTag :company-id="selected.id" large />
      <div class="about">
        <div class="title">{{ selected.name }} at {{ selected.price }}</div>
        <div class="small muted">
          President {{ selected.code ?? 'none' }} · acts {{ ordinal(selected.acts) }} of {{ order.length }}
        </div>
      </div>
      <span class="grow" />
      <div v-if="editMode" class="edit-actions" data-testid="edit-actions">
        <Button label="To front" severity="secondary" outlined @click="toSlot(0)" />
        <Button label="To back" severity="secondary" outlined @click="toSlot()" />
        <Button label="Move to price" severity="secondary" outlined @click="priceDialog = true" />
        <Button label="Close company" severity="danger" outlined @click="askClose(selected.id)" />
      </div>
      <!-- On a phone only the arrow and the price show, as on the TrackPhone board. -->
      <button type="button" class="move" :aria-label="`${selected.up.text} ${selected.up.price}`" @click="step(1)">
        <i class="pi pi-chevron-up" aria-hidden="true" />
        <span><span class="wide">{{ selected.up.text }}&nbsp;</span><span class="mono">{{ selected.up.price }}</span></span>
      </button>
      <button
        type="button"
        class="move"
        :aria-label="`${selected.down.text} ${selected.down.price}${selected.down.note}`"
        @click="step(-1)"
      >
        <i class="pi pi-chevron-down" aria-hidden="true" />
        <span>
          <span class="wide">{{ selected.down.text }}&nbsp;</span><span class="mono">{{ selected.down.price }}</span
          ><span class="wide">{{ selected.down.note }}</span>
        </span>
      </button>
    </div>

    <Dialog
      v-model:visible="priceDialog"
      modal
      :header="selected ? `Move ${selected.name} to a price` : 'Move to a price'"
      :style="{ width: 'min(480px, 100vw)' }"
    >
      <div class="price-grid">
        <button
          v-for="(price, i) in TRACK.slice(1)"
          :key="price"
          type="button"
          class="mono price-btn"
          :class="`zone-${zoneOf(price)}`"
          :data-testid="`price-${price}`"
          @click="toPrice(i + 1)"
        >
          {{ price }}
        </button>
      </div>
      <p class="small muted">The token joins the back of the queue at that price.</p>
    </Dialog>
  </section>
</template>

<style scoped>
.track-view {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.bar {
  flex: none;
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px 0;
}
.hint {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
.grow {
  flex: 1;
}
.narrow {
  display: none;
}
.toggle {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}
.track {
  flex: 1;
  min-height: 0;
  margin: 8px 16px 12px;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(88px, 1fr);
  overflow: auto;
}
.pos {
  min-width: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--line);
}
.pos-head {
  flex: none;
  height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--line-2);
}
.price {
  font-size: 20px;
  line-height: 24px;
}
.zone-name {
  height: 16px;
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
  color: var(--ink-2);
}
.empty {
  margin: 0 16px 12px;
}
.dock {
  flex: none;
  min-height: 88px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 14px;
  padding: 12px 16px;
  background: var(--card);
  border-top: 1px solid var(--line);
}
.dock .title {
  font-size: 16px;
  line-height: 22px;
  font-weight: 600;
}
.edit-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.move {
  height: 56px;
  min-width: 150px;
  padding: 0 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--line-2);
  border-radius: 10px;
  background: var(--card);
  color: var(--ink);
  font-size: 16px;
  font-weight: 600;
}
.price-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 6px;
}
.price-btn {
  height: 44px;
  border: 1px solid var(--line-3);
  border-radius: 8px;
  font-size: 15px;
}

@media (max-width: 719px) {
  .wide {
    display: none;
  }
  .narrow {
    display: inline;
  }
  .bar {
    padding: 0 8px 0 16px;
  }
  .track {
    margin: 0 8px 8px;
    grid-auto-flow: row;
    grid-auto-columns: auto;
    grid-auto-rows: min-content;
  }
  .pos {
    flex-direction: row;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
  .pos-head {
    width: 72px;
    height: auto;
    min-height: 30px;
    border-bottom: 0;
    border-right: 1px solid var(--line-2);
  }
  .pos.occupied .pos-head {
    min-height: 60px;
  }
  .pos:not(.occupied) .price {
    font-size: 14px;
    line-height: 16px;
    font-weight: 500;
    color: var(--muted);
  }
  .pos:not(.occupied) .zone-name {
    display: none;
  }
  .dock {
    padding: 10px 12px;
  }
  .dock .grow {
    display: none;
  }
  .about {
    flex: 1;
    min-width: 0;
  }
  .edit-actions {
    order: 10;
    width: 100%;
  }
  .move {
    flex: none;
    min-width: 76px;
    padding: 0 8px;
    gap: 4px;
  }
}
</style>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import CompanyTag from '../components/CompanyTag.vue'
import PlayerCode from '../components/PlayerCode.vue'
import { startCompany } from '../domain/company'
import { COMPANIES, MINOR_IDS } from '../domain/companies'
import { PHASE_LABEL } from '../domain/format'
import { PHASE_MAX, snapDown, startPrice, startPrices, zoneOf } from '../domain/track'
import type { CompanyId, Game, PlayerId } from '../domain/types'

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ game: Game }>()
const emit = defineEmits<{ start: [game: Game] }>()

const MIN_BID = 120
const companyId = ref<CompanyId | null>(null)
const presidentId = ref<PlayerId | null>(null)
/** The text field's value: a number, or '' while the field is empty. */
const bid = ref<number | string>(MIN_BID)
/** A price tapped on the track. It overrides the price from the bid. */
const tapped = ref<number | null>(null)

watch(
  visible,
  (open) => {
    if (!open) return
    companyId.value = null
    presidentId.value = null
    bid.value = MIN_BID
    tapped.value = null
  },
  { immediate: true },
)

watch(bid, () => {
  tapped.value = null
})

const phase = computed(() => props.game.settings.phase)
const minors = computed(() => MINOR_IDS.filter((id) => props.game.companies[id].status === 'unstarted'))
const allowed = computed(() => startPrices(phase.value))
const trackPrices = startPrices('purple')

const bidPrice = computed(() => {
  try {
    return startPrice(Number(bid.value), phase.value)
  } catch {
    return null
  }
})
const price = computed(() => tapped.value ?? bidPrice.value)

const working = computed(() => {
  if (bidPrice.value === null) return 'A bid is at least 120, in steps of 5.'
  if (tapped.value !== null) return 'Price chosen on the track.'
  const half = Number(bid.value) / 2
  const snapped = snapDown(half)
  let text = `${bid.value} ÷ 2 = ${half}`
  if (snapped !== half) text += `, snapped down to ${snapped}`
  if (bidPrice.value !== snapped) text += `, limited to ${bidPrice.value}`
  return `${text}.`
})

const president = computed(() => props.game.players.find((p) => p.id === presidentId.value))
// The bid is what the president pays, so it must be valid even when a price was tapped.
const canStart = computed(
  () => companyId.value !== null && presidentId.value !== null && price.value !== null && bidPrice.value !== null,
)
const payment = computed(() => {
  if (!president.value || bidPrice.value === null) return null
  const left = president.value.cash - Number(bid.value)
  return { text: `${president.value.name} pays ${bid.value} from cash: ${president.value.cash} becomes ${left}.`, short: left < 0 }
})

function changeBid(delta: number) {
  const current = Number(bid.value)
  bid.value = Math.max(MIN_BID, (Number.isFinite(current) ? current : MIN_BID) + delta)
}

function start() {
  if (companyId.value === null || presidentId.value === null || price.value === null || !canStart.value) return
  emit('start', startCompany(props.game, companyId.value, presidentId.value, price.value, Number(bid.value)))
  visible.value = false
}
</script>

<template>
  <Dialog v-model:visible="visible" modal header="Start a minor company" :style="{ width: 'min(560px, 100vw)' }">
    <div class="dialog-body">
      <div class="field">
        <span class="field-label">Company</span>
        <p v-if="minors.length === 0" class="note">Every minor company has started.</p>
        <div class="companies">
          <button
            v-for="id in minors"
            :key="id"
            type="button"
            class="pick"
            :aria-pressed="companyId === id"
            :data-testid="`company-${id}`"
            @click="companyId = id"
          >
            <CompanyTag :company-id="id" />
            <span class="grow">{{ COMPANIES[id].names[0] }}</span>
            <i v-if="companyId === id" class="pi pi-check tick" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div class="field">
        <span class="field-label">President</span>
        <div class="players">
          <button
            v-for="p in game.players"
            :key="p.id"
            type="button"
            class="pick player"
            :aria-pressed="presidentId === p.id"
            :data-testid="`president-${p.id}`"
            @click="presidentId = p.id"
          >
            <PlayerCode :code="p.code" />{{ p.name }}
          </button>
        </div>
      </div>

      <div class="field">
        <label class="field-label" for="bid">Winning bid</label>
        <div class="bid-row">
          <button type="button" class="bid-btn" aria-label="Lower bid by 5" @click="changeBid(-5)">−</button>
          <input
            id="bid"
            v-model.number="bid"
            class="mono bid-input"
            type="number"
            inputmode="numeric"
            :min="MIN_BID"
            step="5"
            data-testid="bid"
          />
          <button type="button" class="bid-btn" aria-label="Raise bid by 5" @click="changeBid(5)">+</button>
        </div>
        <span class="small muted">Minimum 120, in steps of 5.</span>
      </div>

      <div class="result">
        <div class="result-head">
          <span class="field-label">Starting price</span>
          <span class="mono big" data-testid="start-price">{{ price ?? '–' }}</span>
          <span class="small" :class="bidPrice === null ? 'error-text' : 'muted'">
            {{ working }} {{ PHASE_LABEL[phase] }} phase allows 60–{{ PHASE_MAX[phase] }}.
          </span>
        </div>
        <div class="mini-track">
          <button
            v-for="p in trackPrices"
            :key="p"
            type="button"
            class="mono mini"
            :class="[allowed.includes(p) ? `zone-${zoneOf(p)}` : 'off', { on: price === p }]"
            :disabled="!allowed.includes(p)"
            :aria-pressed="price === p"
            :data-testid="`pick-${p}`"
            @click="tapped = p"
          >
            {{ p }}
          </button>
        </div>
        <span class="small muted">Or tap a price on the track.</span>
      </div>

      <p class="note">
        <i class="pi pi-info-circle" aria-hidden="true" />
        <span>
          {{ president ? president.name : 'The president' }} receives the president card, worth 2 shares. The other 3
          shares go to the company treasury.
        </span>
      </p>
      <p v-if="payment" class="note" :class="{ warn: payment.short }" data-testid="payment">
        <i :class="payment.short ? 'pi pi-exclamation-triangle' : 'pi pi-wallet'" aria-hidden="true" />
        <span>{{ payment.text }}{{ payment.short ? ' That is more cash than they have.' : '' }}</span>
      </p>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button label="Cancel" severity="secondary" outlined @click="visible = false" />
        <Button label="Start company" :disabled="!canStart" data-testid="start-company" @click="start" />
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
.companies {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
.players {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.player {
  flex: 1;
  min-height: 52px;
  justify-content: center;
}
.grow {
  flex: 1;
}
.tick {
  color: var(--primary);
}
.bid-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bid-btn {
  width: 56px;
  height: 56px;
  border: 1px solid var(--line-3);
  border-radius: 8px;
  background: var(--card);
  color: var(--ink);
  font-size: 24px;
}
.bid-input {
  flex: 1;
  min-width: 0;
  height: 56px;
  border: 2px solid var(--primary);
  border-radius: 8px;
  font-size: 28px;
  text-align: center;
}
.result {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--bg);
}
.result-head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 10px;
}
.big {
  font-size: 32px;
  line-height: 36px;
}
.mini-track {
  display: flex;
  gap: 4px;
}
.mini {
  flex: 1;
  height: 44px;
  padding: 0;
  border: 1px solid var(--line-3);
  border-radius: 8px;
  color: var(--ink);
  font-size: 15px;
}
.mini.on {
  border: 3px solid var(--ink);
}
.mini.off {
  background: var(--bg);
  border-style: dashed;
  color: var(--faint);
  text-decoration: line-through;
  cursor: default;
}
.note {
  margin: 0;
}
</style>

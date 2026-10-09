<script setup lang="ts">
import { computed, ref } from 'vue'
import Select from 'primevue/select'
import CompanyTag from '../components/CompanyTag.vue'
import CountStepper from '../components/CountStepper.vue'
import PlayerCode from '../components/PlayerCode.vue'
import ShareCircle from '../components/ShareCircle.vue'
import { displayName, kindOf } from '../domain/companies'
import { setHolding, setMarketShares, setPresident, setTreasuryShares } from '../domain/edit'
import { ordinal } from '../domain/format'
import { presidencyCandidate, transferPresidency } from '../domain/presidency'
import { turnOrder } from '../domain/scoring'
import { TOTAL_SHARES, shareTotal, shares, validate } from '../domain/shares'
import { priceOf } from '../domain/track'
import type { CompanyId, Game, PlayerId } from '../domain/types'

const props = defineProps<{ game: Game; editMode: boolean }>()
const emit = defineEmits<{ update: [game: Game] }>()

/** The key is collapsed on a phone. Wide screens always show it. */
const keyOpen = ref(false)

const warnings = computed(() => validate(props.game))
const codeOf = (id: PlayerId | null) => props.game.players.find((p) => p.id === id)?.code ?? ''

const rows = computed(() =>
  turnOrder(props.game).map((id, i) => {
    const company = props.game.companies[id]
    const name = displayName(company)
    const candidate = presidencyCandidate(props.game, id)
    return {
      id,
      company,
      name,
      price: priceOf(props.game, id),
      acts: ordinal(i + 1),
      total: shareTotal(company),
      expected: TOTAL_SHARES[kindOf(id)],
      // The row already names the company, so drop the "Name: " prefix.
      warnings: warnings.value.filter((w) => w.companyId === id).map((w) => w.message.replace(`${name}: `, '')),
      candidate,
      candidateCode: codeOf(candidate),
    }
  }),
)

const presidentOptions = computed(() => [
  ...props.game.players.map((p) => ({ label: `${p.code} · ${p.name}`, value: p.id as PlayerId | null })),
  { label: 'No president', value: null },
])

function transfer(id: CompanyId, to: PlayerId) {
  emit('update', transferPresidency(props.game, id, to))
}
</script>

<template>
  <section class="ownership">
    <p v-if="rows.length === 0" class="muted">No active companies. Start a company to see its shares here.</p>

    <div v-else class="scroll">
      <div class="table card" :class="{ editing: editMode }" :style="{ '--cols': game.players.length + 2 }">
        <div class="row head">
          <div class="company small label">{{ editMode ? 'Company, president' : 'Company, in turn order' }}</div>
          <div v-for="p in game.players" :key="p.id" class="col-head">
            <PlayerCode :code="p.code" />
            <span class="small muted">{{ p.name }}</span>
          </div>
          <div class="col-head">
            <ShareCircle kind="treasury" />
            <span class="small muted">Treasury</span>
          </div>
          <div class="col-head">
            <ShareCircle kind="market" />
            <span class="small muted">Market</span>
          </div>
          <div class="small label center">Total check</div>
        </div>

        <div v-for="r in rows" :key="r.id" class="row" :class="{ warn: r.warnings.length > 0 }" :data-company="r.id">
          <div class="company">
            <div class="company-name">
              <CompanyTag :company-id="r.id" />
              <span>{{ r.name }}</span>
            </div>
            <div v-if="!editMode" class="small muted">
              <span class="mono ink">{{ r.price }}</span> · acts {{ r.acts }}
            </div>
            <Select
              v-else
              class="president-picker"
              :model-value="r.company.president"
              :options="presidentOptions"
              option-label="label"
              option-value="value"
              placeholder="No president"
              :aria-label="`President of ${r.name}`"
              @update:model-value="(v: PlayerId | null) => emit('update', setPresident(game, r.id, v))"
            />
          </div>

          <div v-for="p in game.players" :key="p.id" class="cell" :data-holder="p.id">
            <template v-if="!editMode">
              <ShareCircle v-if="r.company.president === p.id" kind="president" :company-id="r.id" :code="p.code" />
              <ShareCircle
                v-for="n in r.company.holdings[p.id] ?? 0"
                :key="n"
                kind="share"
                :company-id="r.id"
                :code="p.code"
              />
              <span v-if="shares(r.company, p.id) === 0" class="none" aria-label="none">–</span>
            </template>
            <template v-else>
              <CountStepper
                :model-value="r.company.holdings[p.id] ?? 0"
                :label="`${r.name}, ${p.code}`"
                @update:model-value="(n) => emit('update', setHolding(game, r.id, p.id, n))"
              />
              <span v-if="r.company.president === p.id" class="plus-two small">
                <ShareCircle kind="president" :company-id="r.id" :code="p.code" />+2 card
              </span>
            </template>
          </div>

          <div class="cell" data-holder="treasury">
            <template v-if="!editMode">
              <ShareCircle v-for="n in r.company.treasuryShares" :key="n" kind="treasury" />
              <span v-if="r.company.treasuryShares === 0" class="none" aria-label="none">–</span>
            </template>
            <CountStepper
              v-else
              :model-value="r.company.treasuryShares"
              :label="`${r.name}, treasury`"
              @update:model-value="(n) => emit('update', setTreasuryShares(game, r.id, n))"
            />
          </div>

          <div class="cell" data-holder="market">
            <template v-if="!editMode">
              <ShareCircle v-for="n in r.company.marketShares" :key="n" kind="market" />
              <span v-if="r.company.marketShares === 0" class="none" aria-label="none">–</span>
            </template>
            <CountStepper
              v-else
              :model-value="r.company.marketShares"
              :label="`${r.name}, market`"
              @update:model-value="(n) => emit('update', setMarketShares(game, r.id, n))"
            />
          </div>

          <div class="check">
            <div class="sum" :class="r.total === r.expected ? 'ok' : 'bad'">
              <i :class="r.total === r.expected ? 'pi pi-check' : 'pi pi-exclamation-triangle'" aria-hidden="true" />
              <span class="mono">{{ r.total }}/{{ r.expected }}</span>
            </div>
            <div v-for="message in r.warnings" :key="message" class="warning small">{{ message }}</div>
            <button
              v-if="r.candidate"
              type="button"
              class="transfer"
              data-testid="transfer"
              @click="transfer(r.id, r.candidate)"
            >
              Transfer presidency to {{ r.candidateCode }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <button
      type="button"
      class="key-toggle"
      data-testid="key-toggle"
      aria-controls="ownership-key"
      :aria-expanded="keyOpen"
      @click="keyOpen = !keyOpen"
    >
      <i class="pi pi-info-circle" aria-hidden="true" />
      <span>Key</span>
      <i class="pi" :class="keyOpen ? 'pi-chevron-up' : 'pi-chevron-down'" aria-hidden="true" />
    </button>
    <div id="ownership-key" class="legend small" :class="{ open: keyOpen }">
      <span><ShareCircle kind="share" company-id="express" code="H" />Share, letter is the holder</span>
      <span><ShareCircle kind="president" company-id="express" code="H" />President card, counts as 2 shares</span>
      <span><ShareCircle kind="treasury" />In company treasury</span>
      <span><ShareCircle kind="market" />In the market</span>
    </div>
  </section>
</template>

<style scoped>
.ownership {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}
.scroll {
  overflow-x: auto;
}
.table {
  --col: 72px;
  min-width: calc(164px + var(--cols) * var(--col) + 108px);
}
/* 120px fits a 118px stepper. 4 players plus treasury and market then fit a 1024px tablet. */
.table.editing {
  --col: 120px;
}
.row {
  display: grid;
  grid-template-columns: 164px repeat(var(--cols), minmax(var(--col), 1fr)) 108px;
  align-items: center;
  min-height: 84px;
  border-top: 1px solid var(--line);
}
.row.head {
  min-height: 64px;
  border-top: 0;
  background: var(--head);
}
.row.warn {
  background: var(--amber-bg);
}
.label {
  font-weight: 600;
  color: var(--muted);
}
.center {
  text-align: center;
}
.company {
  min-width: 0;
  padding: 6px 8px 6px 12px;
}
.company-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  margin-bottom: 4px;
}
.company-name span:last-child {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ink {
  color: var(--ink);
}
.president-picker {
  width: 100%;
  min-height: 44px;
}
.col-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.cell {
  align-self: stretch;
  display: flex;
  flex-wrap: wrap;
  align-content: center;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 6px 4px;
  border-left: 1px solid var(--bg);
}
.editing .cell {
  flex-direction: column;
  gap: 4px;
  padding: 6px 0;
}
.none {
  color: var(--faint);
}
.plus-two {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}
.check {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px;
  text-align: center;
}
.sum {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}
.sum.ok {
  color: var(--primary);
}
.sum.bad,
.warning {
  color: var(--amber-ink);
  font-weight: 600;
}
.transfer {
  min-height: 44px;
  padding: 4px 8px;
  border: 1px solid var(--amber);
  border-radius: 8px;
  background: var(--card);
  color: var(--amber-ink);
  font-size: 12px;
  line-height: 14px;
  font-weight: 700;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  color: var(--ink-2);
}
/* Direct children only: a bare "span" would also restyle the circles inside them. */
.legend > span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.key-toggle {
  display: none;
}
@media (max-width: 719px) {
  .ownership {
    padding: 8px;
  }
  .key-toggle {
    align-self: flex-start;
    min-width: 44px;
    min-height: 44px;
    padding: 0 12px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--line-2);
    border-radius: 8px;
    background: var(--card);
    color: var(--ink);
    font-weight: 600;
  }
  .legend:not(.open) {
    display: none;
  }
}
</style>

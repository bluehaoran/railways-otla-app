<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Step from 'primevue/step'
import StepList from 'primevue/steplist'
import StepPanel from 'primevue/steppanel'
import StepPanels from 'primevue/steppanels'
import Stepper from 'primevue/stepper'
import CompanyTag from '../components/CompanyTag.vue'
import PlayerCode from '../components/PlayerCode.vue'
import ShareCircle from '../components/ShareCircle.vue'
import { COMPANIES, MAJOR_IDS, displayName } from '../domain/companies'
import { activeMinors, applyMerge, mergePlan, type MergePlan } from '../domain/merge'
import { shareTotal, shares } from '../domain/shares'
import { priceOf } from '../domain/track'
import type { CompanyId, Game, PlayerId } from '../domain/types'

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ game: Game }>()
const emit = defineEmits<{ merge: [game: Game] }>()

const step = ref('1')
const picked = ref<CompanyId[]>([])
const majorId = ref<CompanyId | null>(null)
/** Chosen name index per major. */
const identities = ref<Record<CompanyId, number>>({})
const chosen = ref<PlayerId | null>(null)

watch(
  visible,
  (open) => {
    if (!open) return
    step.value = '1'
    picked.value = []
    majorId.value = null
    identities.value = {}
    chosen.value = null
  },
  { immediate: true },
)

const player = (id: PlayerId) => props.game.players.find((p) => p.id === id)
const playerName = (id: PlayerId) => player(id)?.name ?? id
const playerCode = (id: PlayerId | null) => (id === null ? null : (player(id)?.code ?? null))
const companyName = (id: CompanyId) => displayName(props.game.companies[id])
const majorName = (id: CompanyId) => COMPANIES[id].names[identities.value[id] ?? 0]

const minors = computed(() =>
  activeMinors(props.game).map((id) => ({
    id,
    name: companyName(id),
    price: priceOf(props.game, id),
    presidentCode: playerCode(props.game.companies[id].president),
    mark: ['A', 'B'][picked.value.indexOf(id)] ?? '',
  })),
)

function toggleMinor(id: CompanyId) {
  const at = picked.value.indexOf(id)
  if (at !== -1) picked.value = picked.value.filter((x) => x !== id)
  else if (picked.value.length < 2) picked.value = [...picked.value, id]
  else picked.value = [picked.value[0], id]
  chosen.value = null
}

const majors = computed(() =>
  MAJOR_IDS.map((id) => ({
    id,
    names: COMPANIES[id].names,
    name: majorName(id),
    identity: identities.value[id] ?? 0,
    available: props.game.companies[id].status === 'unstarted',
  })),
)

function pickName(id: CompanyId, index: number) {
  identities.value = { ...identities.value, [id]: index }
}

const plan = computed<MergePlan | null>(() => {
  if (picked.value.length !== 2 || majorId.value === null) return null
  try {
    return mergePlan(props.game, picked.value[0], picked.value[1], majorId.value, {
      identity: identities.value[majorId.value] ?? 0,
      president: chosen.value ?? undefined,
    })
  } catch {
    return null
  }
})

const list = (ids: PlayerId[]) => {
  const names = ids.map(playerName)
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

const reason = computed(() => {
  const p = plan.value
  if (!p) return ''
  const most = Math.max(...Object.values(p.shares))
  const tie = `${list(p.tiedPlayers)} tie at ${most} shares.`
  if (p.reason === 'most-shares' && p.newPresident) {
    return `${playerName(p.newPresident)} holds the most shares (${most}) and becomes president.`
  }
  if (p.reason === 'tie-break' && p.newPresident && p.decidingCompany) {
    const other = p.decidingCompany === p.aId ? p.bId : p.aId
    const name = playerName(p.newPresident)
    return `${tie} ${name} is president of ${companyName(p.decidingCompany)}, which acts before ${companyName(other)}, so ${name} takes the presidency.`
  }
  if (p.reason === 'chosen' && p.newPresident) return `${tie} You chose ${playerName(p.newPresident)}.`
  return `${tie} None of them is president of ${companyName(p.aId)} or ${companyName(p.bId)}, so the rules cannot decide. Choose the new president.`
})

const priceText = computed(() => {
  const p = plan.value
  if (!p) return ''
  const a = priceOf(props.game, p.aId) ?? 0
  const b = priceOf(props.game, p.bId) ?? 0
  const average = (a + b) / 2
  return `Average of ${a} and ${b} is ${average}${average === p.price ? '' : `, snapped down to ${p.price}`}.`
})

const table = computed(() => {
  const p = plan.value
  if (!p) return null
  const a = props.game.companies[p.aId]
  const b = props.game.companies[p.bId]
  return {
    players: props.game.players.map((pl) => ({
      id: pl.id,
      code: pl.code,
      name: pl.name,
      a: shares(a, pl.id),
      b: shares(b, pl.id),
      m: p.shares[pl.id],
      aPresident: a.president === pl.id,
      bPresident: b.president === pl.id,
      mPresident: p.newPresident === pl.id,
    })),
    treasury: { a: a.treasuryShares, b: b.treasuryShares, m: p.treasuryShares },
    market: { a: a.marketShares, b: b.marketShares, m: p.marketShares },
    total: { a: shareTotal(a), b: shareTotal(b), m: p.total },
  }
})

const dash = (n: number) => (n === 0 ? '–' : String(n))

const summary = computed(() => {
  if (step.value === '1') return picked.value.length === 0 ? 'Choose two minors' : picked.value.map(companyName).join(' + ')
  if (step.value === '2') return majorId.value === null ? 'Choose a major' : `${majorName(majorId.value)} (${COMPANIES[majorId.value].abbr})`
  return plan.value?.needsChoice ? 'Choose a president to continue' : ''
})

const canNext = computed(() => (step.value === '1' ? picked.value.length === 2 : majorId.value !== null))

function back() {
  if (step.value === '1') visible.value = false
  else step.value = String(Number(step.value) - 1)
}

function confirmMerge() {
  if (!plan.value || plan.value.needsChoice) return
  emit('merge', applyMerge(props.game, plan.value))
  visible.value = false
}
</script>

<template>
  <Dialog v-model:visible="visible" modal header="Merge two minors into a major" :style="{ width: 'min(600px, 100vw)' }">
    <Stepper :value="step" linear>
      <StepList>
        <Step value="1">Minors</Step>
        <Step value="2">Major</Step>
        <Step value="3">Preview</Step>
      </StepList>
      <StepPanels>
        <StepPanel value="1">
          <div v-if="step === '1'" class="panel">
            <p class="lead-text">Choose two active minors. They are listed in turn order.</p>
            <button
              v-for="m in minors"
              :key="m.id"
              type="button"
              class="pick minor"
              :aria-pressed="m.mark !== ''"
              :data-testid="`minor-${m.id}`"
              @click="toggleMinor(m.id)"
            >
              <span class="mark" :class="{ on: m.mark !== '' }">{{ m.mark }}</span>
              <CompanyTag :company-id="m.id" />
              <span class="grow strong">{{ m.name }}</span>
              <span class="mono price">{{ m.price }}</span>
              <ShareCircle v-if="m.presidentCode !== null" kind="president" :company-id="m.id" :code="m.presidentCode" />
            </button>
          </div>
        </StepPanel>

        <StepPanel value="2">
          <div v-if="step === '2'" class="panel">
            <p class="lead-text">
              Choose the major that replaces {{ picked.map(companyName).join(' and ') }}. Where a major has two names,
              pick the one on your box.
            </p>
            <div class="majors">
              <div v-for="m in majors" :key="m.id" class="major" :class="{ on: majorId === m.id, off: !m.available }">
                <button
                  type="button"
                  class="major-main"
                  :aria-pressed="majorId === m.id"
                  :disabled="!m.available"
                  :data-testid="`major-${m.id}`"
                  @click="majorId = m.id"
                >
                  <CompanyTag :company-id="m.id" large />
                  <span class="grow major-name">{{ m.name }}</span>
                  <i v-if="majorId === m.id" class="pi pi-check tick" aria-hidden="true" />
                </button>
                <div v-if="!m.available" class="small muted one-name">Already in play</div>
                <div v-else-if="m.names.length > 1" class="names">
                  <button
                    v-for="(name, i) in m.names"
                    :key="name"
                    type="button"
                    :aria-pressed="m.identity === i"
                    :data-testid="`name-${m.id}-${i}`"
                    @click="pickName(m.id, i)"
                  >
                    {{ name }}
                  </button>
                </div>
                <div v-else class="small muted one-name">One name only</div>
              </div>
            </div>
          </div>
        </StepPanel>

        <StepPanel value="3">
          <div v-if="step === '3' && plan && table && majorId" class="panel" data-testid="preview">
            <div class="equation strong">
              <CompanyTag :company-id="plan.aId" />{{ companyName(plan.aId) }}
              <span class="muted">+</span>
              <CompanyTag :company-id="plan.bId" />{{ companyName(plan.bId) }}
              <i class="pi pi-arrow-right" aria-hidden="true" />
              <CompanyTag :company-id="majorId" />{{ majorName(majorId) }}
            </div>

            <p class="note" :class="{ warn: plan.needsChoice }">
              <i :class="plan.needsChoice ? 'pi pi-exclamation-triangle' : 'pi pi-info-circle'" aria-hidden="true" />
              <span>{{ reason }}</span>
            </p>

            <div v-if="plan.reason === 'needs-choice' || plan.reason === 'chosen'" class="choice">
              <span class="field-label">New president, required</span>
              <div class="choices" role="radiogroup">
                <button
                  v-for="id in plan.tiedPlayers"
                  :key="id"
                  type="button"
                  role="radio"
                  class="pick choose"
                  :aria-checked="chosen === id"
                  :data-testid="`choose-${id}`"
                  @click="chosen = id"
                >
                  <span class="radio" :class="{ on: chosen === id }" />
                  <PlayerCode :code="playerCode(id) ?? ''" :size="32" />
                  <span class="grow">
                    {{ playerName(id) }}
                    <span class="small muted block">{{ plan.shares[id] }} shares</span>
                  </span>
                </button>
              </div>
            </div>

            <div class="cards">
              <div class="result lead" data-testid="new-president">
                <ShareCircle
                  v-if="plan.newPresident"
                  kind="president"
                  :company-id="majorId"
                  :code="playerCode(plan.newPresident) ?? ''"
                  large
                />
                <div>
                  <div class="small strong">New president</div>
                  <div class="strong big-name">{{ plan.newPresident ? playerName(plan.newPresident) : 'Not chosen' }}</div>
                </div>
              </div>
              <div class="result" data-testid="new-price">
                <span class="mono big">{{ plan.price }}</span>
                <div>
                  <div class="small strong">New price</div>
                  <div class="small muted">{{ priceText }}</div>
                </div>
              </div>
            </div>

            <div class="table">
              <div class="trow thead small">
                <span>Shares held</span>
                <span class="num">{{ companyName(plan.aId) }}</span>
                <span class="num">{{ companyName(plan.bId) }}</span>
                <span class="num">{{ majorName(majorId) }}</span>
              </div>
              <div v-for="r in table.players" :key="r.id" class="trow" :class="{ faint: r.m === 0 }">
                <span class="who"><PlayerCode :code="r.code" :size="24" />{{ r.name }}</span>
                <span class="num mono">
                  <ShareCircle v-if="r.aPresident" kind="president" :company-id="plan.aId" :code="r.code" />{{ dash(r.a) }}
                </span>
                <span class="num mono">
                  <ShareCircle v-if="r.bPresident" kind="president" :company-id="plan.bId" :code="r.code" />{{ dash(r.b) }}
                </span>
                <span class="num mono strong">
                  <ShareCircle v-if="r.mPresident" kind="president" :company-id="majorId" :code="r.code" />{{ dash(r.m) }}
                </span>
              </div>
              <div class="trow">
                <span class="who"><ShareCircle kind="treasury" />Treasury</span>
                <span class="num mono">{{ dash(table.treasury.a) }}</span>
                <span class="num mono">{{ dash(table.treasury.b) }}</span>
                <span class="num mono strong">{{ dash(table.treasury.m) }}</span>
              </div>
              <div class="trow">
                <span class="who"><ShareCircle kind="market" />Market</span>
                <span class="num mono">{{ dash(table.market.a) }}</span>
                <span class="num mono">{{ dash(table.market.b) }}</span>
                <span class="num mono strong">{{ dash(table.market.m) }}</span>
              </div>
              <div class="trow tfoot">
                <span class="strong">Total</span>
                <span class="num mono">{{ table.total.a }}</span>
                <span class="num mono">{{ table.total.b }}</span>
                <span class="num mono" :class="{ bad: table.total.m !== 10 }" data-testid="total-m">{{ table.total.m }}</span>
              </div>
            </div>

            <p v-if="table.total.m !== 10" class="note warn">
              <i class="pi pi-exclamation-triangle" aria-hidden="true" />
              <span>The shares do not total 10. You can still merge and fix the counts in edit mode.</span>
            </p>
            <p class="small muted">
              {{ majorName(majorId) }} joins the back of the {{ plan.price }} queue. {{ companyName(plan.aId) }} and
              {{ companyName(plan.bId) }} leave the track. This is one undoable step.
            </p>
          </div>
        </StepPanel>
      </StepPanels>
    </Stepper>

    <template #footer>
      <div class="dialog-footer">
        <span class="grow" :class="{ 'need-choice': step === '3' && plan?.needsChoice }">{{ summary }}</span>
        <Button :label="step === '1' ? 'Cancel' : 'Back'" severity="secondary" outlined data-testid="back" @click="back" />
        <Button
          v-if="step !== '3'"
          label="Next"
          :disabled="!canNext"
          data-testid="next"
          @click="step = String(Number(step) + 1)"
        />
        <Button
          v-else
          label="Confirm merge"
          :disabled="!plan || plan.needsChoice"
          data-testid="confirm-merge"
          @click="confirmMerge"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.lead-text {
  margin: 0;
  color: var(--ink-2);
}
.strong {
  font-weight: 600;
}
.grow {
  flex: 1;
}
.block {
  display: block;
}
.minor {
  min-height: 56px;
  gap: 12px;
  border-radius: 10px;
}
.mark {
  flex: none;
  width: 28px;
  height: 28px;
  border: 2px solid var(--faint);
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  line-height: 24px;
  text-align: center;
}
.mark.on {
  border-color: var(--ink);
  border-radius: 50%;
  background: var(--ink);
}
.price {
  width: 44px;
  text-align: right;
  font-size: 16px;
}
.majors {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.major {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border: 1px solid var(--line-3);
  border-radius: 12px;
  background: var(--card);
}
.major.on {
  border: 2px solid var(--primary);
  padding: 7px;
  background: var(--lead);
}
.major.off {
  opacity: 0.5;
}
.major-main {
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 6px;
  border: 0;
  background: transparent;
  color: var(--ink);
  text-align: left;
}
.major-main:disabled {
  cursor: default;
}
.major-name {
  font-size: 16px;
  font-weight: 600;
}
.tick {
  color: var(--primary);
}
.names {
  display: flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--line-2);
  border-radius: 10px;
  background: var(--bg);
}
.names button {
  flex: 1;
  min-height: 38px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--muted);
  font-size: 14px;
  font-weight: 500;
}
.names button[aria-pressed='true'] {
  background: var(--card);
  box-shadow: 0 1px 3px rgba(24, 24, 27, 0.2);
  color: var(--ink);
  font-weight: 600;
}
.one-name {
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 0 8px;
}
.equation {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.note {
  margin: 0;
}
.choice {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.choices {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.choose {
  flex: 1;
  min-height: 60px;
  gap: 12px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
}
.radio {
  flex: none;
  width: 24px;
  height: 24px;
  border: 2px solid var(--faint);
  border-radius: 50%;
}
.radio.on {
  border: 7px solid var(--primary);
}
.cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.result {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--line-2);
  border-radius: 12px;
}
.result.lead {
  border: 2px solid var(--primary);
  background: var(--lead);
}
.big {
  font-size: 32px;
  line-height: 36px;
}
.big-name {
  font-size: 16px;
}
.table {
  border: 1px solid var(--line-2);
  border-radius: 12px;
  overflow: hidden;
}
.trow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px 96px 108px;
  align-items: center;
  min-height: 38px;
  padding: 0 12px;
  border-top: 1px solid var(--bg);
}
.trow.thead {
  min-height: 36px;
  border-top: 0;
  background: var(--head);
  font-weight: 600;
  color: var(--muted);
}
.trow.tfoot {
  border-top: 2px solid var(--ink);
  font-weight: 600;
}
.trow.faint {
  color: var(--faint);
}
.who {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.num {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  text-align: right;
}
.thead .num {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}
.bad,
.need-choice {
  color: var(--amber-ink);
  font-weight: 600;
}
@media (max-width: 519px) {
  .majors,
  .cards {
    grid-template-columns: 1fr;
  }
  .trow {
    grid-template-columns: minmax(0, 1fr) 64px 64px 72px;
  }
}
</style>

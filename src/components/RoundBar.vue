<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import { PHASE_LABEL } from '../domain/format'
import { cycleCount, hasMergerRound, isGameOver, operatedProgress } from '../domain/rounds'
import type { Game, RoundType } from '../domain/types'

const props = defineProps<{ game: Game }>()
const emit = defineEmits<{ next: []; phase: [] }>()

const ORDER: RoundType[] = ['SR', 'OR1', 'OR2', 'MR']
const NAME: Record<RoundType, string> = {
  SR: 'Stock Round',
  OR1: 'Operating Round 1',
  OR2: 'Operating Round 2',
  MR: 'Merger Round',
}
const NEXT_LABEL: Record<RoundType, string> = {
  SR: 'End Stock Round',
  OR1: 'Start Operating Round 2',
  OR2: 'End Operating Rounds',
  MR: 'End Merger Round',
}

const over = computed(() => isGameOver(props.game))
const heading = computed(() =>
  over.value ? 'Game over' : `Cycle ${props.game.round.cycle} of ${cycleCount(props.game)}`,
)
const chips = computed(() => {
  const current = ORDER.indexOf(props.game.round.type)
  return ORDER.map((type, i) => ({
    type,
    label: type,
    name: NAME[type],
    state: over.value || i < current ? 'done' : i === current ? 'current' : 'todo',
    skipped: type === 'MR' && !hasMergerRound(props.game),
  }))
})
const detail = computed(() => {
  if (over.value) return 'The final ranking is on the Scoreboard.'
  const type = props.game.round.type
  if (type === 'OR1' || type === 'OR2') {
    const p = operatedProgress(props.game)
    return `${p.done} of ${p.total} companies operated`
  }
  return NAME[type]
})
</script>

<template>
  <section class="round-bar" aria-label="Round tracker" data-testid="round-bar">
    <div class="cycle">{{ heading }}</div>

    <ol class="chips">
      <li
        v-for="c in chips"
        :key="c.type"
        class="chip"
        :class="[c.state, { skipped: c.skipped }]"
        :aria-current="c.state === 'current' && !over ? 'step' : undefined"
        :title="c.skipped ? 'Skipped until the green phase' : c.name"
      >
        {{ c.label }}
      </li>
    </ol>

    <button
      type="button"
      class="phase"
      data-testid="round-phase"
      :aria-label="`Phase ${PHASE_LABEL[game.settings.phase]}. Change the phase`"
      @click="emit('phase')"
    >
      <span class="dot" :class="game.settings.phase" aria-hidden="true" />
      {{ PHASE_LABEL[game.settings.phase] }}
    </button>

    <span class="detail small">{{ detail }}</span>
    <span class="grow" />
    <Button v-if="!over" :label="NEXT_LABEL[game.round.type]" data-testid="round-next" @click="emit('next')" />
  </section>
</template>

<style scoped>
.round-bar {
  flex: none;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 8px 16px;
  background: var(--head);
  border-bottom: 1px solid var(--line);
}
.cycle {
  font-weight: 700;
  white-space: nowrap;
}
.chips {
  display: flex;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.chip {
  min-width: 40px;
  height: 28px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line-2);
  border-radius: 14px;
  background: var(--card);
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}
.chip.done {
  background: var(--lead);
  border-color: var(--primary);
  color: var(--primary);
}
.chip.current {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
.chip.skipped {
  border-style: dashed;
  color: var(--faint);
  background: transparent;
}
.phase {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border: 1px solid var(--line-2);
  border-radius: 8px;
  background: var(--card);
  color: var(--ink);
  font-weight: 600;
}
.dot {
  width: 12px;
  height: 12px;
  border-radius: 6px;
  border: 1px solid rgba(24, 24, 27, 0.45);
}
.dot.yellow {
  background: var(--zone-yellow);
}
.dot.green {
  background: var(--zone-green);
}
.dot.purple {
  background: var(--zone-purple);
}
.detail {
  color: var(--ink-2);
}
.grow {
  flex: 1;
}
.round-bar :deep(button.p-button) {
  min-height: 44px;
}
@media (max-width: 719px) {
  .round-bar {
    padding: 6px 12px;
    gap: 6px 8px;
  }
  .detail {
    order: 5;
    flex-basis: 100%;
  }
  .grow {
    display: none;
  }
  .round-bar :deep(button.p-button) {
    order: 6;
    flex: 1 1 100%;
  }
}
</style>

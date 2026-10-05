<script setup lang="ts">
import { computed } from 'vue'
import CrownIcon from './CrownIcon.vue'
import { COMPANIES } from '../domain/companies'
import type { CompanyId } from '../domain/types'

const props = withDefaults(
  defineProps<{
    kind: 'share' | 'president' | 'treasury' | 'market'
    companyId?: CompanyId
    code?: string
    large?: boolean
    /** Swap fill and ink. Used for the president circle that sits on a company token. */
    inverted?: boolean
  }>(),
  { large: false, inverted: false },
)

const filled = computed(() => props.kind === 'share' || props.kind === 'president')

const style = computed(() => {
  if (!filled.value || !props.companyId) return undefined
  const { color, ink } = COMPANIES[props.companyId]
  return props.inverted ? { background: ink, color } : { background: color, color: ink }
})

const label = computed(() => {
  if (props.kind === 'treasury') return 'Treasury share'
  if (props.kind === 'market') return 'Market share'
  if (props.kind === 'president') return `President card held by ${props.code}, counts as 2 shares`
  return `Share held by ${props.code}`
})
</script>

<template>
  <span class="share" :class="[kind, { large }]" :style="style" :data-kind="kind" role="img" :aria-label="label">
    <CrownIcon v-if="kind === 'president'" :size="large ? 17 : 11" />
    <template v-if="filled">{{ code }}</template>
  </span>
</template>

<style scoped>
.share {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  line-height: 12px;
  font-weight: 700;
}
.share.share,
.share.president {
  border: var(--token-border);
}
.share.treasury {
  border: 2px dashed var(--muted);
}
.share.market {
  border: 2px solid var(--muted);
}
.share.large {
  width: 44px;
  height: 44px;
  font-size: 16px;
  line-height: 17px;
  gap: 1px;
}
.share.large.treasury,
.share.large.market {
  border-width: 3px;
}
</style>

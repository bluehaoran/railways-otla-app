<script setup lang="ts">
import { computed } from 'vue'
import ShareCircle from './ShareCircle.vue'
import { COMPANIES } from '../domain/companies'
import type { CompanyId } from '../domain/types'

const props = withDefaults(
  defineProps<{
    companyId: CompanyId
    presidentCode: string | null
    label: string
    /** Overall turn order across the whole track, 1 acts first. */
    rank?: number | null
    selected?: boolean
  }>(),
  { rank: null, selected: false },
)
const info = computed(() => COMPANIES[props.companyId])
</script>

<template>
  <button
    type="button"
    class="token"
    :class="{ selected }"
    :style="{ background: info.color, color: info.ink }"
    :data-id="companyId"
    :aria-label="label"
    :aria-pressed="selected"
  >
    <span v-if="rank !== null" class="rank">{{ rank }}</span>
    <span class="abbr">{{ info.abbr }}</span>
    <ShareCircle v-if="presidentCode !== null" kind="president" :company-id="companyId" :code="presidentCode" inverted />
  </button>
</template>

<style scoped>
.token {
  position: relative;
  flex: none;
  width: 76px;
  height: 52px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: var(--token-border);
  border-radius: 8px;
  font-weight: 700;
  touch-action: manipulation;
}
.token.selected {
  box-shadow:
    0 0 0 3px #fff,
    0 0 0 6px var(--ink);
}
.abbr {
  font-size: 18px;
}
.rank {
  position: absolute;
  top: -9px;
  left: -9px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--ink);
  color: #fff;
  border: 1.5px solid #fff;
  font-size: 12px;
  line-height: 17px;
  text-align: center;
}
@media (max-width: 719px) {
  .token {
    height: 44px;
  }
  .abbr {
    font-size: 17px;
  }
}
</style>

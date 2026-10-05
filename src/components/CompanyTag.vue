<script setup lang="ts">
import { computed } from 'vue'
import { COMPANIES } from '../domain/companies'
import type { CompanyId } from '../domain/types'

const props = withDefaults(defineProps<{ companyId: CompanyId; large?: boolean }>(), { large: false })
const info = computed(() => COMPANIES[props.companyId])
</script>

<template>
  <span class="tag" :class="{ large }" :style="{ background: info.color, color: info.ink }">{{ info.abbr }}</span>
</template>

<style scoped>
.tag {
  flex: none;
  width: 34px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: var(--token-border);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}
.tag.large {
  width: 48px;
  height: 34px;
  border-radius: 8px;
  font-size: 17px;
}
</style>

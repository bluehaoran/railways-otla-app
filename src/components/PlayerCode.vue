<script setup lang="ts">
withDefaults(defineProps<{ code: string; size?: number }>(), { size: 28 })
</script>

<template>
  <span class="player-code" :style="{ width: `${size}px`, height: `${size}px`, fontSize: size >= 32 ? '13px' : '12px' }">{{ code }}</span>
</template>

<style scoped>
.player-code {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--ink);
  color: #fff;
  font-weight: 700;
  line-height: 1;
}
</style>

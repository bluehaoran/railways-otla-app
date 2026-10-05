<script setup lang="ts">
defineProps<{ modelValue: number; label: string }>()
defineEmits<{ 'update:modelValue': [value: number] }>()
</script>

<template>
  <div class="stepper">
    <button
      type="button"
      :aria-label="`Decrease ${label}`"
      :disabled="modelValue <= 0"
      @click="$emit('update:modelValue', Math.max(0, modelValue - 1))"
    >
      −
    </button>
    <span class="mono value">{{ modelValue }}</span>
    <button type="button" :aria-label="`Increase ${label}`" @click="$emit('update:modelValue', modelValue + 1)">+</button>
  </div>
</template>

<style scoped>
.stepper {
  display: inline-flex;
  align-items: center;
  height: 44px;
  border: 1px solid var(--line-3);
  border-radius: 8px;
  background: var(--card);
  overflow: hidden;
}
button {
  width: 44px;
  height: 42px;
  border: 0;
  background: var(--card);
  color: var(--ink);
  font-size: 20px;
  line-height: 20px;
  font-weight: 500;
}
button:disabled {
  color: var(--line-3);
  cursor: default;
}
.value {
  width: 28px;
  text-align: center;
  font-size: 18px;
}
</style>

<script setup lang="ts">
defineEmits<{ done: [] }>()
</script>

<template>
  <div class="edit-banner" role="status">
    <i class="pi pi-pencil" aria-hidden="true" />
    <strong>Edit mode</strong>
    <span class="text">Any value is accepted. Rule warnings show but never block.</span>
    <span class="grow" />
    <button type="button" @click="$emit('done')">Done</button>
  </div>
</template>

<style scoped>
.edit-banner {
  flex: none;
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 16px;
  background: var(--amber);
  color: #fff;
}
.grow {
  flex: 1;
}
button {
  height: 36px;
  padding: 0 14px;
  border: 1.5px solid #fff;
  border-radius: 8px;
  background: transparent;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}
@media (max-width: 719px) {
  .text {
    display: none;
  }
}
</style>

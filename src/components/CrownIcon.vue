<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 11 })
</script>

<template>
  <!-- Crown artwork from the Components board: three points on a base bar, 24 unit grid. -->
  <svg :width="size" :height="Math.round(size * 0.9)" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.6 10H4.6z" />
    <rect x="4.5" y="19.5" width="15" height="2.2" rx="1" />
  </svg>
</template>

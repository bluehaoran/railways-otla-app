<script setup lang="ts">
import { ref } from 'vue'
import { useSortable } from '@vueuse/integrations/useSortable'
import type { CompanyId } from '../domain/types'

// One track position's queue. In edit mode its tokens can be dragged to any queue.
// The parent re-creates this component after every drop, because SortableJS moves
// DOM nodes itself and Vue must render the new state from scratch.
const props = defineProps<{ index: number; editMode: boolean }>()
const emit = defineEmits<{ drop: [payload: { id: CompanyId; index: number; slot: number }] }>()

const el = ref<HTMLElement | null>(null)

useSortable(el, ref<CompanyId[]>([]), {
  group: 'track',
  animation: 150,
  draggable: '.token',
  disabled: !props.editMode,
  // Replace the default handler, which would reorder the list argument.
  onUpdate: () => {},
  onEnd(event) {
    const id = event.item.dataset.id
    const index = Number(event.to.dataset.index)
    if (!id || Number.isNaN(index)) return
    if (event.from === event.to && event.oldDraggableIndex === event.newDraggableIndex) return
    emit('drop', { id, index, slot: event.newDraggableIndex ?? 0 })
  },
})
</script>

<template>
  <div ref="el" class="queue" :data-index="index">
    <slot />
  </div>
</template>

<style scoped>
.queue {
  flex: 1;
  min-height: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 14px 4px;
}
@media (max-width: 719px) {
  .queue {
    min-height: 0;
    flex-direction: row;
    padding: 8px 12px;
  }
}
</style>

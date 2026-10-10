<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import SelectButton from 'primevue/selectbutton'
import { PHASE_LABEL } from '../domain/format'
import type { Game, ViewId } from '../domain/types'

export type MenuAction = 'saves' | 'new' | 'export' | 'settings' | 'close'

const props = defineProps<{
  game: Game
  canUndo: boolean
  canRedo: boolean
  canMerge: boolean
  canStart: boolean
  startHint: string | null
  mergeHint: string | null
  badges: { ownership: number; scoreboard: number }
}>()
const view = defineModel<ViewId>('view', { required: true })
const editMode = defineModel<boolean>('editMode', { required: true })
const emit = defineEmits<{ start: []; merge: []; undo: []; redo: []; action: [name: MenuAction] }>()

const views: { label: string; value: ViewId }[] = [
  { label: 'Track', value: 'track' },
  { label: 'Ownership', value: 'ownership' },
  { label: 'Scoreboard', value: 'scoreboard' },
]
const badge = (value: ViewId) => (value === 'ownership' ? props.badges.ownership : value === 'scoreboard' ? props.badges.scoreboard : 0)

const subtitle = computed(
  () => `${PHASE_LABEL[props.game.settings.phase]} · ${props.game.settings.shortGame ? 'Short' : 'Long'} game`,
)

const menu = ref<InstanceType<typeof Menu> | null>(null)
const items = [
  { label: 'Saved games', icon: 'pi pi-folder-open', command: () => emit('action', 'saves') },
  { label: 'New game', icon: 'pi pi-plus', command: () => emit('action', 'new') },
  { label: 'Export this game', icon: 'pi pi-download', command: () => emit('action', 'export') },
  { label: 'Settings', icon: 'pi pi-cog', command: () => emit('action', 'settings') },
  { label: 'Close game', icon: 'pi pi-sign-out', command: () => emit('action', 'close') },
]
</script>

<template>
  <header class="top">
    <div class="title">
      <div class="name">{{ game.name }}</div>
      <div class="small muted">{{ subtitle }}</div>
    </div>

    <SelectButton
      v-model="view"
      class="views"
      :options="views"
      option-label="label"
      option-value="value"
      :allow-empty="false"
      aria-label="View"
    >
      <template #option="{ option }">
        <span>{{ option.label }}</span>
        <span v-if="badge(option.value) > 0" class="badge" :aria-label="`${badge(option.value)} warnings`">
          <i class="pi pi-exclamation-triangle" aria-hidden="true" />{{ badge(option.value) }}
        </span>
      </template>
    </SelectButton>

    <span class="grow" />

    <div class="actions">
      <div class="buttons">
      <Button
        label="Start company"
        icon="pi pi-plus"
        :disabled="!canStart"
        :title="startHint ?? undefined"
        :aria-describedby="startHint ? 'topbar-hint-start' : undefined"
        data-testid="start"
        @click="emit('start')"
      />
      <Button
        label="Merge"
        icon="pi pi-share-alt"
        severity="secondary"
        outlined
        :disabled="!canMerge"
        :title="mergeHint ?? undefined"
        :aria-describedby="mergeHint ? 'topbar-hint-merge' : undefined"
        data-testid="merge"
        @click="emit('merge')"
      />
      </div>
      <p v-if="startHint || mergeHint" class="gate-hint small muted" data-testid="topbar-hint">
        <span v-if="startHint" id="topbar-hint-start">{{ startHint }}</span>
        <span v-if="mergeHint" id="topbar-hint-merge">{{ mergeHint }}</span>
      </p>
    </div>

    <button
      type="button"
      class="icon-btn edit"
      :class="{ on: editMode }"
      aria-label="Edit mode"
      :aria-pressed="editMode"
      @click="editMode = !editMode"
    >
      <i class="pi pi-pencil" aria-hidden="true" />
    </button>
    <button type="button" class="icon-btn" aria-label="Undo" :disabled="!canUndo" @click="emit('undo')">
      <i class="pi pi-undo" aria-hidden="true" />
    </button>
    <button type="button" class="icon-btn" aria-label="Redo" :disabled="!canRedo" @click="emit('redo')">
      <i class="pi pi-refresh" aria-hidden="true" />
    </button>
    <button type="button" class="icon-btn" aria-label="Menu" aria-haspopup="true" @click="(e) => menu?.toggle(e)">
      <i class="pi pi-bars" aria-hidden="true" />
    </button>
    <Menu ref="menu" :model="items" popup />
  </header>
</template>

<style scoped>
.top {
  flex: none;
  min-height: 64px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--card);
  border-bottom: 1px solid var(--line);
}
.title {
  min-width: 0;
  max-width: 200px;
}
.name {
  font-size: 16px;
  line-height: 20px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.grow {
  flex: 1;
}
.actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.buttons {
  display: flex;
  gap: 8px;
}
.gate-hint {
  margin: 0;
  max-width: 320px;
  text-align: right;
  line-height: 16px;
}
.gate-hint span + span::before {
  content: ' · ';
}
.views :deep(button) {
  min-height: 44px;
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 20px;
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--amber-chip);
  color: var(--amber-ink);
  font-size: 12px;
  font-weight: 700;
}
.badge .pi {
  font-size: 11px;
}
.edit.on {
  border-color: var(--amber);
  background: var(--amber);
  color: #fff;
}
@media (max-width: 719px) {
  .top {
    flex-wrap: wrap;
    gap: 4px;
    padding: 6px 8px 8px 12px;
  }
  .title {
    flex: 1;
    max-width: none;
  }
  .grow,
  .actions {
    display: none;
  }
  .views {
    order: 10;
    width: 100%;
    display: flex;
  }
  .views :deep(button) {
    flex: 1;
  }
}
</style>

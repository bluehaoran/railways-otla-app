<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import ConfirmDialog from 'primevue/confirmdialog'
import Dialog from 'primevue/dialog'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import AppTopBar, { type MenuAction } from './components/AppTopBar.vue'
import EditBanner from './components/EditBanner.vue'
import SavesList from './components/SavesList.vue'
import MergeWizard from './dialogs/MergeWizard.vue'
import SettingsDialog from './dialogs/SettingsDialog.vue'
import SetupDialog from './dialogs/SetupDialog.vue'
import StartCompanyDialog from './dialogs/StartCompanyDialog.vue'
import { renameGame } from './domain/edit'
import { canMerge } from './domain/merge'
import { validate } from './domain/shares'
import type { Game, ViewId } from './domain/types'
import { downloadText } from './state/download'
import { useGame } from './state/game'
import { exportFileName, exportGame, useSaves } from './state/saves'
import OwnershipView from './views/OwnershipView.vue'
import ScoreboardView from './views/ScoreboardView.vue'
import TrackView from './views/TrackView.vue'

const store = useGame()
const saves = useSaves()
const toast = useToast()
const { game, canUndo, canRedo, saveWarning } = store

if (game.value === null) store.resume()

const view = ref<ViewId>('track')
const editMode = ref(false)
const setupOpen = ref(false)
const startOpen = ref(false)
const mergeOpen = ref(false)
const savesOpen = ref(false)
const settingsOpen = ref(false)

// A different game starts on its own main view, outside edit mode.
watch(
  () => game.value?.id,
  () => {
    const main = game.value?.settings.mainView
    view.value = main === 'ownership' || main === 'scoreboard' ? main : 'track'
    editMode.value = false
  },
  { immediate: true },
)

const warnings = computed(() => (game.value ? validate(game.value) : []))
const badges = computed(() => ({
  ownership: warnings.value.filter((w) => w.companyId !== undefined).length,
  scoreboard: warnings.value.filter((w) => w.code === 'negative-cash').length,
}))
const mergeable = computed(() => game.value !== null && canMerge(game.value))

watch(
  saveWarning,
  (message) => {
    if (message === null) return
    toast.add({ severity: 'warn', summary: 'Storage', detail: message, life: 8000 })
    saveWarning.value = null
  },
  { immediate: true },
)

function commit(next: Game) {
  store.commit(next)
}

function onAction(name: MenuAction) {
  if (name === 'saves') savesOpen.value = true
  else if (name === 'new') setupOpen.value = true
  else if (name === 'settings') settingsOpen.value = true
  else if (name === 'close') store.close()
  else if (name === 'export' && game.value) downloadText(exportFileName(game.value), exportGame(game.value))
}

function openSaved(id: string) {
  const save = saves.read(id)
  if (!save) {
    toast.add({ severity: 'error', summary: 'Saved games', detail: 'This saved game could not be read.', life: 6000 })
    return
  }
  store.open(save)
  savesOpen.value = false
}

function renameSaved(id: string, name: string) {
  if (game.value?.id === id) store.commit(renameGame(game.value, name))
  else saves.rename(id, name)
}

function removeSaved(id: string) {
  if (game.value?.id === id) store.close()
  saves.remove(id)
}
</script>

<template>
  <Toast position="bottom-center" />
  <ConfirmDialog />

  <div v-if="game" class="app">
    <AppTopBar
      v-model:view="view"
      v-model:edit-mode="editMode"
      :game="game"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :can-merge="mergeable"
      :badges="badges"
      @start="startOpen = true"
      @merge="mergeOpen = true"
      @undo="store.undo()"
      @redo="store.redo()"
      @action="onAction"
    />
    <EditBanner v-if="editMode" @done="editMode = false" />

    <main class="main">
      <TrackView v-if="view === 'track'" :game="game" :edit-mode="editMode" @update="commit" />
      <OwnershipView v-else-if="view === 'ownership'" :game="game" :edit-mode="editMode" @update="commit" />
      <ScoreboardView v-else :game="game" @update="commit" />
    </main>

    <footer class="bottom-actions">
      <Button label="Start company" icon="pi pi-plus" class="primary" @click="startOpen = true" />
      <Button label="Merge" icon="pi pi-share-alt" severity="secondary" outlined :disabled="!mergeable" @click="mergeOpen = true" />
    </footer>

    <div v-if="editMode" class="frame" aria-hidden="true" />

    <StartCompanyDialog v-model:visible="startOpen" :game="game" @start="commit" />
    <MergeWizard v-model:visible="mergeOpen" :game="game" @merge="commit" />
    <SettingsDialog v-model:visible="settingsOpen" :game="game" :edit-mode="editMode" @update="commit" />
    <Dialog v-model:visible="savesOpen" modal header="Saved games" :style="{ width: 'min(640px, 100vw)' }">
      <SavesList :saves="saves" :current-id="game.id" @open="openSaved" @rename="renameSaved" @remove="removeSaved" />
    </Dialog>
  </div>

  <main v-else class="home">
    <h1>Lost Atlas Tracker</h1>
    <p class="muted">Scorekeeper for Railways of the Lost Atlas. Games are saved on this device.</p>
    <div>
      <Button label="New game" icon="pi pi-plus" data-testid="home-new" @click="setupOpen = true" />
    </div>
    <SavesList :saves="saves" :current-id="null" @open="openSaved" @rename="renameSaved" @remove="removeSaved" />
  </main>

  <SetupDialog v-model:visible="setupOpen" @start="store.create" />
</template>

<style scoped>
.app {
  height: 100dvh;
  display: flex;
  flex-direction: column;
}
.main {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.bottom-actions {
  display: none;
}
/* Edit mode signal: a 4px amber frame around the whole screen. */
.frame {
  position: fixed;
  inset: 0;
  border: 4px solid var(--amber);
  pointer-events: none;
  z-index: 10;
}
.home {
  max-width: 640px;
  margin: 0 auto;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
h1 {
  margin: 0;
  font-size: 24px;
  line-height: 32px;
}
.home p {
  margin: 0;
}
@media (max-width: 719px) {
  .bottom-actions {
    flex: none;
    display: flex;
    gap: 8px;
    padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
    background: var(--card);
    border-top: 1px solid var(--line);
  }
  .bottom-actions :deep(button) {
    min-height: 48px;
    flex: 2;
  }
  .bottom-actions :deep(button.primary) {
    flex: 3;
  }
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { downloadText } from '../state/download'
import { ImportError, exportFileName, exportGame, type SaveIndexEntry, type Saves } from '../state/saves'

const props = defineProps<{ saves: Saves; currentId: string | null }>()
const emit = defineEmits<{ open: [id: string]; rename: [id: string, name: string]; remove: [id: string] }>()

const confirm = useConfirm()
const toast = useToast()

const entries = computed(() => props.saves.index.value)
const fileInput = ref<HTMLInputElement | null>(null)
const renaming = ref<SaveIndexEntry | null>(null)
const renameOpen = ref(false)
const newName = ref('')

const when = (iso: string) => new Date(iso).toLocaleString()
const failed = (detail: string) => toast.add({ severity: 'error', summary: 'Saved games', detail, life: 6000 })

function duplicate(id: string) {
  if (props.saves.duplicate(id) === null) failed('This game could not be copied.')
}

function exportSave(id: string) {
  const save = props.saves.read(id)
  if (!save) return failed('This saved game could not be read.')
  downloadText(exportFileName(save.game), exportGame(save.game))
}

function askRemove(entry: SaveIndexEntry) {
  confirm.require({
    header: 'Delete saved game?',
    message: `${entry.name} and its undo history will be deleted. This cannot be undone.`,
    acceptProps: { label: 'Delete', severity: 'danger' },
    rejectProps: { label: 'Cancel', severity: 'secondary', outlined: true },
    accept: () => emit('remove', entry.id),
  })
}

function startRename(entry: SaveIndexEntry) {
  renaming.value = entry
  newName.value = entry.name
  renameOpen.value = true
}

function saveRename() {
  const name = newName.value.trim()
  if (renaming.value && name !== '') emit('rename', renaming.value.id, name)
  renameOpen.value = false
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const game = props.saves.importText(await file.text())
    toast.add({ severity: 'success', summary: 'Saved games', detail: `Imported ${game.name}.`, life: 4000 })
  } catch (error) {
    failed(error instanceof ImportError ? error.message : 'The file could not be read.')
  }
  input.value = ''
}
</script>

<template>
  <div class="saves">
    <div class="saves-bar">
      <span class="field-label">Saved games</span>
      <span class="grow" />
      <Button label="Import" icon="pi pi-upload" severity="secondary" outlined @click="fileInput?.click()" />
      <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onFile" />
    </div>

    <DataTable :value="entries" data-key="id" size="small">
      <template #empty>No saved games yet.</template>
      <Column header="Game">
        <template #body="{ data }">
          <div :data-save="data.id" class="game-name">
            {{ data.name }}
            <span v-if="data.id === currentId" class="open-now">Open now</span>
          </div>
          <div class="small muted">{{ data.playerNames.join(', ') }} · {{ when(data.updatedAt) }}</div>
        </template>
      </Column>
      <Column header="Actions" class="actions-col">
        <template #body="{ data }">
          <div class="actions">
            <button type="button" class="icon-btn" :aria-label="`Open ${data.id}`" title="Open" @click="emit('open', data.id)">
              <i class="pi pi-folder-open" aria-hidden="true" />
            </button>
            <button type="button" class="icon-btn" :aria-label="`Rename ${data.id}`" title="Rename" @click="startRename(data)">
              <i class="pi pi-pencil" aria-hidden="true" />
            </button>
            <button type="button" class="icon-btn" :aria-label="`Duplicate ${data.id}`" title="Duplicate" @click="duplicate(data.id)">
              <i class="pi pi-copy" aria-hidden="true" />
            </button>
            <button type="button" class="icon-btn" :aria-label="`Export ${data.id}`" title="Export" @click="exportSave(data.id)">
              <i class="pi pi-download" aria-hidden="true" />
            </button>
            <button type="button" class="icon-btn" :aria-label="`Delete ${data.id}`" title="Delete" @click="askRemove(data)">
              <i class="pi pi-trash" aria-hidden="true" />
            </button>
          </div>
        </template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="renameOpen" modal header="Rename game" :style="{ width: 'min(420px, 100vw)' }">
      <InputText v-model="newName" fluid aria-label="Game name" data-testid="rename-input" @keydown.enter="saveRename" />
      <template #footer>
        <div class="dialog-footer">
          <Button label="Cancel" severity="secondary" outlined @click="renameOpen = false" />
          <Button label="Save" :disabled="newName.trim() === ''" data-testid="rename-save" @click="saveRename" />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.saves {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.saves-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}
.grow {
  flex: 1;
}
.game-name {
  font-weight: 600;
}
.open-now {
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--lead);
  color: var(--primary);
  font-size: 12px;
  font-weight: 600;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
}
</style>

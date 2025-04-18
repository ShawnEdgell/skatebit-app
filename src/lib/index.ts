// src/lib/index.ts

// ----- Components -----
export { default as CrudModal } from './components/CrudModal.svelte'
export { default as DropOverlay } from './components/DropOverlay.svelte'
export { default as DropZone } from './components/DropZone.svelte'
export { default as FolderSelector } from './components/FolderSelector.svelte'
export { default as NavBar } from './components/NavBar.svelte'
export { default as ThemeController } from './components/ThemeController.svelte'
export { default as Toast } from './components/Toast.svelte'
export { default as Updater } from './components/Updater.svelte'

// ----- Services -----
export * from './services/dragDropService'
export * from './services/fileService'
export * from './services/modioService'
export * from './services/pathService'
export * from './services/symlinkService'

// ----- Stores -----
export * from './stores/explorerStore'
export * from './stores/globalPathsStore'
export * from './stores/mapsStore'
export * from './stores/localSearchStore'
export * from './stores/modioSearchStore'
export * from './stores/uiStore'

// ----- Types -----
export * from './types/fsTypes'
export * from './types/modioTypes'
export * from './types/searchTypes'
export * from './types/uiTypes'

// ----- Utils -----
export * from './utils/errorHandler'
export * from './utils/flexSearchUtils'
export * from './utils/formatter'
export * from './utils/toastUtils'
export * from './utils/useFileUpload'

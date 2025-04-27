<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte'
  import { writable, get } from 'svelte/store'
  import type { Writable } from 'svelte/store'
  import type { User } from 'firebase/auth'

  // --- Tauri Imports ---
  import { open as openDialog } from '@tauri-apps/plugin-dialog'
  import { readTextFile } from '@tauri-apps/plugin-fs'
  import { join, basename } from '@tauri-apps/api/path' // Use Tauri's path functions
  import { normalizePath } from '$lib/services/pathService' // Keep your normalizePath

  // --- Store Imports ---
  import { explorerDirectory } from '$lib/stores/globalPathsStore' // Needed for default path

  // --- Local Imports ---
  import { handleError, handleSuccess } from '$lib/utils/errorHandler'
  import { saveConfigXml } from '$lib/firebase/configs'
  import LoginButtonGoogle from '$lib/components/LoginButtonGoogle.svelte'
  import { UploadCloud, File as FileIcon } from 'lucide-svelte' // Added FileIcon
  import type { Category } from './CategorySelector.svelte'

  // --- Props ---
  export let selectedCategory: Category
  export let user: User | null
  export let isDeleting: boolean = false

  // --- State ---
  const isUploading = writable(false)
  const uploadFileName = writable('') // Display name for the hub
  const uploadDescription = writable('')
  const uploadCooldownActive = writable(false)
  let selectedFilePath: string | null = null // Store the full path
  let selectedFileContent: string | null = null // Store the file content
  let selectedOriginalName: string | null = null // Store the original filename
  let cooldownTimer: number | undefined

  const dispatch = createEventDispatcher()

  // --- Constants ---
  const MAX_DESCRIPTION_LENGTH = 500

  // --- Computed ---
  $: descriptionLength = $uploadDescription.length
  $: descriptionTooLong = descriptionLength > MAX_DESCRIPTION_LENGTH

  // --- Functions ---

  // Function to trigger the Tauri file open dialog
  async function openFileDialog() {
    const baseDir = get(explorerDirectory)
    if (!baseDir || baseDir.startsWith('/error')) {
      handleError(
        new Error(
          'Skater XL directory not set or invalid. Cannot determine default path.',
        ),
        'File Upload',
      )
      return
    }

    let defaultPath = baseDir
    try {
      // Construct the category-specific default path
      const categoryPath = await join(baseDir, selectedCategory.subfolder)
      defaultPath = normalizePath(categoryPath) // Use normalized path
    } catch (e) {
      console.error('Error constructing default path:', e)
      // Fallback to baseDir if join fails
      handleError(e, 'Default Path Calculation')
    }

    try {
      const result = await openDialog({
        title: `Select ${selectedCategory.name} Preset File`,
        multiple: false,
        directory: false,
        defaultPath: defaultPath, // Set the starting directory
        filters: [{ name: 'Config Files', extensions: ['xml', 'config'] }],
      })

      if (typeof result === 'string') {
        // User selected a single file
        const filePath = normalizePath(result)
        const fileName = await basename(filePath) // Get filename.ext
        const fileContent = await readTextFile(filePath) // Read content

        // Update state
        selectedFilePath = filePath
        selectedFileContent = fileContent
        selectedOriginalName = fileName
        uploadFileName.set(fileName.replace(/\.(xml|config)$/i, '')) // Pre-fill display name
        uploadDescription.set('') // Reset description
      } else if (result === null) {
        console.log('File selection cancelled.')
        // Optionally clear previous selection if needed
        // selectedFilePath = null;
        // selectedFileContent = null;
        // selectedOriginalName = null;
        // uploadFileName.set('');
        // uploadDescription.set('');
      }
    } catch (e) {
      handleError(e, 'Opening File Dialog')
      // Reset state on error
      selectedFilePath = null
      selectedFileContent = null
      selectedOriginalName = null
      uploadFileName.set('')
      uploadDescription.set('')
    }
  }

  function startUploadCooldown(durationMs: number = 5000) {
    /* ... */
  }

  async function upload() {
    if ($uploadCooldownActive) {
      /* ... */ return
    }
    if (!user) {
      /* ... */ return
    }
    // Check for selected file content and path now
    if (!selectedFilePath || selectedFileContent === null) {
      handleError(
        new Error('Please select a file to upload using the button.'),
        'Upload',
      )
      return
    }
    const name = get(uploadFileName).trim()
    if (!name) {
      /* ... */ return
    }
    const description = get(uploadDescription).trim()
    if (descriptionTooLong) {
      /* ... */ return
    }

    isUploading.set(true)
    try {
      // Use the stored file content directly
      const xml = selectedFileContent
      const categoryKey = selectedCategory.key

      await saveConfigXml(categoryKey, name, xml, description)

      handleSuccess(
        `Uploaded ${name}.xml to ${selectedCategory.name} Hub`,
        'Upload',
      )

      // Reset state after successful upload
      uploadFileName.set('')
      uploadDescription.set('')
      selectedFilePath = null
      selectedFileContent = null
      selectedOriginalName = null

      dispatch('uploadComplete')
      startUploadCooldown()
    } catch (e) {
      handleError(e, `Uploading ${name}.xml`)
    } finally {
      isUploading.set(false)
    }
  }

  onDestroy(() => {
    /* ... */
  })
</script>

<div class="bg-base-100 rounded-box flex-shrink-0 p-4 shadow-md">
  {#if user}
    <div>
      <h3 class="mb-2 font-medium">
        Upload {selectedCategory.name} Preset
      </h3>
      <div class="space-y-2">
        <button
          type="button"
          class="btn btn-sm w-full justify-start"
          on:click={openFileDialog}
          disabled={$isUploading || isDeleting || $uploadCooldownActive}
        >
          <FileIcon class="mr-2 h-4 w-4" />
          {#if selectedOriginalName}
            {selectedOriginalName}
          {:else}
            Select File...
          {/if}
        </button>

        {#if selectedFilePath}
          <input
            type="text"
            placeholder="Enter display name for Hub"
            class="input input-bordered input-sm w-full"
            bind:value={$uploadFileName}
            disabled={$isUploading || isDeleting || $uploadCooldownActive}
          />
          <textarea
            class="textarea textarea-bordered textarea-sm w-full"
            rows="3"
            placeholder="Optional: Add a brief description (max {MAX_DESCRIPTION_LENGTH} chars)"
            bind:value={$uploadDescription}
            maxlength={MAX_DESCRIPTION_LENGTH + 10}
            disabled={$isUploading || isDeleting || $uploadCooldownActive}
          ></textarea>
          <div
            class="text-right text-xs {descriptionTooLong
              ? 'text-error'
              : 'text-base-content/70'}"
          >
            {descriptionLength}/{MAX_DESCRIPTION_LENGTH}
          </div>
        {/if}

        <button
          class="btn btn-primary btn-sm w-full"
          on:click={upload}
          disabled={!selectedFilePath || // Disable if no file path selected
            !$uploadFileName.trim() ||
            descriptionTooLong ||
            $isUploading ||
            isDeleting ||
            $uploadCooldownActive}
        >
          {#if $isUploading}
            <span class="loading loading-spinner loading-xs mr-2"
            ></span>Uploading…
          {:else if $uploadCooldownActive}
            Please wait...
          {:else}
            <UploadCloud class="mr-1 h-5 w-5" /> Upload File
          {/if}
        </button>
      </div>
    </div>
  {:else}
    <div class="space-y-4 text-center">
      <h3 class="mb-2 font-medium">Upload Presets</h3>
      <p class="text-base-content/70 text-sm">
        Log in to upload {selectedCategory.name} presets.
      </p>
      <LoginButtonGoogle />
    </div>
  {/if}
</div>

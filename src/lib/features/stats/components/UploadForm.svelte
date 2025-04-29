<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { writable, get } from 'svelte/store'
  import type { User } from 'firebase/auth'
  import { open as openDialog } from '@tauri-apps/plugin-dialog'
  import { readTextFile } from '@tauri-apps/plugin-fs'
  import { join, basename } from '@tauri-apps/api/path'
  import { normalizePath } from '$lib/services/pathService'
  import { explorerDirectory } from '$lib/stores/globalPathsStore'
  import {
    selectedFilePath,
    selectedFileContent,
    selectedOriginalName,
    uploadFileName,
    uploadDescription,
  } from '$lib/stores/uploadFormStore'
  import { handleError, handleSuccess } from '$lib/utils/errorHandler'
  import { saveConfigXml } from '$lib/firebase/configs'
  import LoginButtonGoogle from '$lib/components/LoginButtonGoogle.svelte'
  import { UploadCloud, File as FileIcon } from 'lucide-svelte'
  import type { Category } from './CategorySelector.svelte'

  export let selectedCategory: Category
  export let user: User | null
  export let isDeleting: boolean = false

  const isUploading = writable(false)
  const uploadCooldownActive = writable(false)
  const MAX_DESCRIPTION_LENGTH = 500
  let cooldownTimer: ReturnType<typeof setTimeout>

  const dispatch = createEventDispatcher()

  $: descriptionLength = $uploadDescription.length
  $: descriptionTooLong = descriptionLength > MAX_DESCRIPTION_LENGTH

  async function openFileDialog() {
    const baseDir = get(explorerDirectory)
    if (!baseDir || baseDir.startsWith('/error')) {
      handleError(
        new Error('Skater XL directory not set or invalid.'),
        'File Upload',
      )
      return
    }

    let defaultPath = baseDir
    try {
      const categoryPath = await join(baseDir, selectedCategory.subfolder)
      defaultPath = normalizePath(categoryPath)
    } catch (e) {
      console.error('Error constructing default path:', e)
      handleError(e, 'Default Path Calculation')
    }

    try {
      const result = await openDialog({
        title: `Select ${selectedCategory.name} Preset File`,
        multiple: false,
        directory: false,
        defaultPath,
        filters: [{ name: 'Config Files', extensions: ['xml', 'config'] }],
      })

      if (typeof result === 'string') {
        const filePath = normalizePath(result)
        const fileName = await basename(filePath)
        const fileContent = await readTextFile(filePath)

        selectedFilePath.set(filePath)
        selectedFileContent.set(fileContent)
        selectedOriginalName.set(fileName)
        uploadFileName.set(fileName.replace(/\.(xml|config)$/i, ''))
        uploadDescription.set('')
      }
    } catch (e) {
      handleError(e, 'Opening File Dialog')
      selectedFilePath.set(null)
      selectedFileContent.set(null)
      selectedOriginalName.set(null)
      uploadFileName.set('')
      uploadDescription.set('')
    }
  }

  function startUploadCooldown(durationMs: number = 5000) {
    uploadCooldownActive.set(true)
    clearTimeout(cooldownTimer)
    cooldownTimer = setTimeout(() => {
      uploadCooldownActive.set(false)
    }, durationMs)
  }

  async function upload() {
    if ($uploadCooldownActive || !user) return
    const filePath = get(selectedFilePath)
    const fileContent = get(selectedFileContent)
    const fileName = get(uploadFileName).trim()
    const description = get(uploadDescription).trim()

    if (!filePath || !fileContent) {
      handleError(new Error('Please select a file to upload.'), 'Upload')
      return
    }

    if (!fileName || descriptionTooLong) return

    isUploading.set(true)
    try {
      await saveConfigXml(
        selectedCategory.key,
        fileName,
        fileContent,
        description,
      )
      handleSuccess(
        `Uploaded ${fileName}.xml to ${selectedCategory.name} Hub`,
        'Upload',
      )

      selectedFilePath.set(null)
      selectedFileContent.set(null)
      selectedOriginalName.set(null)
      uploadFileName.set('')
      uploadDescription.set('')
      dispatch('uploadComplete')
      startUploadCooldown()
    } catch (e) {
      handleError(e, `Uploading ${fileName}.xml`)
    } finally {
      isUploading.set(false)
    }
  }
</script>

<div class="bg-base-100 rounded-box flex-shrink-0 p-4 shadow-md">
  {#if user}
    <div>
      <h3 class="mb-2 font-medium">Upload {selectedCategory.name} Preset</h3>
      <div class="space-y-2">
        <button
          type="button"
          class="btn btn-sm w-full justify-start"
          on:click={openFileDialog}
          disabled={$isUploading || isDeleting || $uploadCooldownActive}
        >
          <FileIcon class="mr-2 h-4 w-4" />
          {#if $selectedOriginalName}
            {$selectedOriginalName}
          {:else}
            Select File...
          {/if}
        </button>

        {#if $selectedFilePath}
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
          disabled={!$selectedFilePath ||
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

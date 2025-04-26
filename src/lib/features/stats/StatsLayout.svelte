<script lang="ts">
  import { onMount } from 'svelte'
  import { writable, get, derived } from 'svelte/store'
  import { writeFile } from '@tauri-apps/plugin-fs'
  import { join } from '@tauri-apps/api/path'
  import { normalizePath } from '$lib/services/pathService'
  import { explorerDirectory } from '$lib/stores/globalPathsStore'
  import { handleError, handleSuccess } from '$lib/utils/errorHandler'
  import { user as userStore } from '$lib/stores/authStore'
  import { openModal } from '$lib/stores/uiStore'
  import GoogleLogin from '$lib/components/GoogleLogin.svelte'
  import LocalFileList from './components/LocalFileList.svelte'
  import FormattedDate from './components/FormattedDate.svelte'
  import { Timestamp } from 'firebase/firestore' // Import Timestamp class for instanceof check

  import {
    listConfigMeta,
    fetchConfigXml,
    saveConfigXml,
    incrementDownloadCount,
    toggleLikeConfigXml,
    deleteConfigXml,
    type ConfigMeta,
  } from '$lib/firebase/configs'

  import {
    BarChart2,
    User,
    Activity,
    UploadCloud,
    ThumbsUp,
    Trash2,
  } from 'lucide-svelte'
  import type { SvelteComponent } from 'svelte'

  type Category = {
    key: string
    name: string
    subfolder: string
    Icon: typeof SvelteComponent
  }

  type SortOption = 'latest' | 'downloads' | 'likes'

  const categories: Category[] = [
    {
      key: 'stats',
      name: 'Stats',
      subfolder: 'XXLMod3/StatsCollections',
      Icon: BarChart2,
    },
    {
      key: 'stance',
      name: 'Stance',
      subfolder: 'XXLMod3/StanceCollections',
      Icon: User,
    },
    {
      key: 'steeze',
      name: 'Steeze',
      subfolder: 'XXLMod3/SteezeCollections',
      Icon: Activity,
    },
  ]

  const selectedCategory = writable<Category>(categories[0])
  const configs = writable<ConfigMeta[]>([])
  const sortBy = writable<SortOption>('latest')
  const isLoadingList = writable(true)
  const isUploading = writable(false)
  const isDownloading = writable<string | null>(null)
  const isDeleting = writable<string | null>(null)

  const uploadFileName = writable('')
  let selectedFile: File | null = null
  let fileInput!: HTMLInputElement

  // --- Client-Side Sorting ---
  const sortedConfigs = derived([configs, sortBy], ([$configs, $sortBy]) => {
    const configsCopy = [...$configs]
    try {
      switch ($sortBy) {
        case 'downloads':
          return configsCopy.sort(
            (a, b) => (b.downloadCount || 0) - (a.downloadCount || 0),
          )
        case 'likes':
          return configsCopy.sort(
            (a, b) => (b.likesBy?.length || 0) - (a.likesBy?.length || 0),
          )
        case 'latest':
        default:
          return configsCopy.sort((a, b) => {
            // --- FIX: Check if createdAt is a Timestamp before calling toDate ---
            const timeA =
              a.createdAt instanceof Timestamp
                ? a.createdAt.toDate().getTime()
                : 0
            const timeB =
              b.createdAt instanceof Timestamp
                ? b.createdAt.toDate().getTime()
                : 0
            return timeB - timeA // Descending
          })
      }
    } catch (e) {
      console.error('Sorting error:', e)
      return $configs
    }
  })

  $: $selectedCategory, loadConfigs()

  onMount(() => {
    loadConfigs()
  })

  async function loadConfigs() {
    isLoadingList.set(true)
    try {
      const currentCategory = get(selectedCategory)
      if (!currentCategory || !currentCategory.key) {
        console.warn('Selected category is invalid, skipping config load.')
        configs.set([])
        isLoadingList.set(false)
        return
      }
      configs.set(await listConfigMeta(currentCategory.key))
    } catch (e) {
      handleError(
        e,
        `Loading ${get(selectedCategory)?.name || 'unknown'} configs`,
      )
      configs.set([])
    } finally {
      isLoadingList.set(false)
    }
  }

  function handleFileSelect(e: Event) {
    const inp = e.target as HTMLInputElement
    if (inp.files?.length) {
      selectedFile = inp.files[0]
      uploadFileName.set(selectedFile.name.replace(/\.xml$/i, ''))
    } else {
      selectedFile = null
      uploadFileName.set('')
    }
  }

  async function upload() {
    const user = get(userStore)
    if (!user) {
      handleError(new Error('You must be signed in to upload'), 'Auth')
      return
    }
    if (!selectedFile) return
    const name = get(uploadFileName).trim()
    if (!name) {
      handleError(
        new Error('Please provide a display name for the upload.'),
        'Upload',
      )
      return
    }

    isUploading.set(true)
    try {
      const xml = await selectedFile.text()
      const categoryKey = get(selectedCategory).key
      await saveConfigXml(categoryKey, name, xml)
      handleSuccess(
        `Uploaded ${name}.xml to ${get(selectedCategory).name} Hub`,
        'Upload',
      )
      uploadFileName.set('')
      selectedFile = null
      if (fileInput) fileInput.value = ''

      await loadConfigs()
    } catch (e) {
      handleError(e, 'Uploading config')
    } finally {
      isUploading.set(false)
    }
  }

  async function download(name: string) {
    isDownloading.set(name)
    try {
      const categoryKey = get(selectedCategory).key
      const xml = await fetchConfigXml(categoryKey, name)
      if (xml === null) throw new Error(`Config "${name}" not found in hub`)

      const base = get(explorerDirectory)
      if (!base || base.startsWith('/error'))
        throw new Error('Skater XL directory not set or invalid')

      const dest = normalizePath(
        await join(base, get(selectedCategory).subfolder, `${name}.xml`),
      )

      await writeFile(dest, new TextEncoder().encode(xml))
      await incrementDownloadCount(categoryKey, name)
      handleSuccess(`Downloaded to ${dest}`, 'Download')

      setTimeout(loadConfigs, 500)
    } catch (e) {
      handleError(e, `Downloading ${name}`)
    } finally {
      isDownloading.set(null)
    }
  }

  async function toggleLike(name: string) {
    const user = get(userStore)
    if (!user) {
      handleError(new Error('You must be signed in to like'), 'Auth')
      return
    }
    try {
      const categoryKey = get(selectedCategory).key
      await toggleLikeConfigXml(categoryKey, name)
      await loadConfigs()
    } catch (e) {
      handleError(e, 'Toggling Like')
    }
  }

  async function handleDelete(fileName: string) {
    const categoryKey = get(selectedCategory).key
    openModal({
      title: 'Confirm Deletion',
      message: `Are you sure you want to permanently delete "${fileName}.xml" from the Community Hub? This cannot be undone.`,
      confirmText: 'Delete Permanently',
      cancelText: 'Cancel',
      confirmClass: 'btn-error',
      onSave: async () => {
        isDeleting.set(fileName)
        try {
          await deleteConfigXml(categoryKey, fileName)
          handleSuccess(`Deleted "${fileName}.xml" from Hub`, 'Delete')
          await loadConfigs() // Refresh the list
        } catch (error) {
          handleError(error, `Deleting ${fileName}`)
        } finally {
          isDeleting.set(null)
        }
      },
    })
  }
</script>

<div class="flex h-full w-full gap-4 px-4 pb-4">
  <aside class="flex h-full w-1/3 flex-shrink-0 flex-col gap-4">
    <div class="bg-base-100 rounded-box flex-shrink-0 p-4 shadow-md">
      <label
        for="category-select"
        class="text-base-content/80 mb-2 block text-sm font-medium"
        >Select Category</label
      >
      <select
        id="category-select"
        class="select select-bordered select-sm w-full"
        bind:value={$selectedCategory}
        disabled={$isDownloading !== null || $isDeleting !== null}
      >
        {#each categories as cat (cat.key)}
          <option value={cat}>{cat.name}</option>
        {/each}
      </select>
    </div>

    <div class="bg-base-100 rounded-box flex-shrink-0 p-4 shadow-md">
      {#if $userStore}
        <div>
          <h3 class="mb-2 font-medium">
            Upload new {$selectedCategory.name} to Hub
          </h3>
          <div class="space-y-2">
            <input
              type="file"
              bind:this={fileInput}
              accept=".xml"
              on:change={handleFileSelect}
              class="file-input file-input-bordered file-input-sm w-full"
              disabled={$isUploading || $isDeleting !== null}
            />
            {#if selectedFile}
              <input
                type="text"
                placeholder="Enter display name for Hub"
                class="input input-bordered input-sm w-full"
                bind:value={$uploadFileName}
                disabled={$isUploading || $isDeleting !== null}
              />
            {/if}
            <button
              class="btn btn-primary btn-sm w-full"
              on:click={upload}
              disabled={!selectedFile ||
                !$uploadFileName.trim() ||
                $isUploading ||
                $isDeleting !== null}
            >
              {#if $isUploading}
                <span class="loading loading-spinner loading-xs mr-2"
                ></span>Uploading…
              {:else}
                <UploadCloud class="mr-2 h-5 w-5" /> Upload File
              {/if}
            </button>
          </div>
          <div class="divider my-3 text-xs">Account</div>
          <GoogleLogin />
        </div>
      {:else}
        <div class="space-y-4 text-center">
          <h3 class="mb-2 font-medium">Upload Presets</h3>
          <p class="text-base-content/70 text-sm">
            Log in to upload {$selectedCategory.name} presets.
          </p>
          <GoogleLogin />
        </div>
      {/if}
    </div>

    <div
      class="bg-base-100 rounded-box flex min-h-0 flex-grow flex-col p-4 shadow-md"
    >
      <h3 class="text-base-content/80 mb-2 flex-shrink-0 text-sm font-medium">
        Local {$selectedCategory.name} Files
      </h3>
      <div class="min-h-0 flex-grow overflow-y-auto">
        <LocalFileList category={$selectedCategory} />
      </div>
    </div>
  </aside>

  <main
    class="bg-base-100 rounded-box flex h-full min-h-0 w-2/3 flex-col p-4 shadow-md"
  >
    <div class="mb-3 flex flex-shrink-0 items-center justify-between gap-4">
      <h3 class="text-base font-medium">
        Community Hub: {$selectedCategory.name}
      </h3>
      <div class="flex items-center gap-2">
        <label
          for="sort-select"
          class="text-base-content/70 w-20 text-xs font-medium">Sort by:</label
        >
        <select
          id="sort-select"
          class="select select-bordered select-xs"
          bind:value={$sortBy}
          disabled={$isLoadingList || $isDeleting !== null}
        >
          <option value="latest">Latest</option>
          <option value="downloads">Downloads</option>
          <option value="likes">Likes</option>
        </select>
      </div>
    </div>

    <div class="min-h-0 flex-grow overflow-y-auto">
      {#if $isLoadingList}
        <div class="flex h-full items-center justify-center">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      {:else if $configs.length === 0}
        <div class="flex h-full flex-col items-center justify-center">
          <p class="text-base-content/60 py-4 text-center text-sm">
            No public configs found for {$selectedCategory.name} yet. Be the first
            to upload one!
          </p>
        </div>
      {:else}
        <ul class="space-y-2">
          {#each $sortedConfigs as c (c.fileName)}
            <li
              class="hover:bg-base-200 flex items-center justify-between gap-4 rounded p-2"
            >
              <div class="flex-1 space-y-1 overflow-hidden">
                <div class="flex items-center gap-2">
                  <svelte:component
                    this={$selectedCategory.Icon}
                    class="h-5 w-5 flex-shrink-0"
                  />
                  <span
                    class="truncate font-mono font-medium"
                    title="{c.fileName}.xml">{c.fileName}.xml</span
                  >
                </div>
                <div class="text-base-content/70 truncate text-xs">
                  by <strong>{c.author?.name || 'Anonymous'}</strong>
                  {#if c.createdAt}
                    on <FormattedDate date={c.createdAt as Timestamp} />
                  {/if}
                </div>
                <div class="text-base-content/70 mt-1 text-xs">
                  Downloads: {c.downloadCount || 0}
                </div>
              </div>

              <div class="flex flex-shrink-0 items-center gap-2">
                <button
                  class="btn btn-ghost btn-xs gap-1"
                  title="Like this config"
                  on:click={() => toggleLike(c.fileName)}
                  disabled={!$userStore ||
                    $isDownloading === c.fileName ||
                    $isDeleting !== null}
                >
                  <ThumbsUp
                    class={`h-4 w-4 transition-colors ${$userStore && c.likesBy?.includes($userStore.uid) ? 'text-primary fill-current' : 'text-base-content/50'}`}
                  />
                  <span class="text-sm font-medium"
                    >{c.likesBy?.length || 0}</span
                  >
                </button>
                <button
                  class="btn btn-primary btn-xs"
                  on:click={() => download(c.fileName)}
                  disabled={$isDownloading === c.fileName ||
                    !$explorerDirectory ||
                    $explorerDirectory.startsWith('/error') ||
                    $isDeleting !== null}
                  title={!$explorerDirectory ||
                  $explorerDirectory.startsWith('/error')
                    ? 'Set Skater XL directory first'
                    : `Download ${c.fileName}.xml`}
                >
                  {#if $isDownloading === c.fileName}
                    <span class="loading loading-spinner loading-xs mr-1"
                    ></span>Downloading…
                  {:else}
                    Download
                  {/if}
                </button>
                {#if $userStore && c.author?.uid === $userStore.uid}
                  <button
                    class="btn btn-ghost btn-error btn-xs"
                    title="Delete your config"
                    on:click={() => handleDelete(c.fileName)}
                    disabled={$isDeleting === c.fileName ||
                      $isDownloading === c.fileName}
                  >
                    {#if $isDeleting === c.fileName}
                      <span class="loading loading-spinner loading-xs"></span>
                    {:else}
                      <Trash2 class="h-4 w-4" />
                    {/if}
                  </button>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </main>
</div>

<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { writable, get, derived } from 'svelte/store'
  import type { Writable, Unsubscriber } from 'svelte/store'
  import { Timestamp } from 'firebase/firestore'

  import { explorerDirectory } from '$lib/stores/globalPathsStore'
  import { user as userStore } from '$lib/stores/authStore'
  import { openModal } from '$lib/stores/uiStore'

  import { writeFile } from '@tauri-apps/plugin-fs'
  import { join } from '@tauri-apps/api/path'
  import { normalizePath } from '$lib/services/pathService'
  import { handleError, handleSuccess } from '$lib/utils/errorHandler'
  import {
    listConfigMeta,
    fetchConfigXml,
    incrementDownloadCount,
    toggleLikeConfigXml,
    deleteConfigXml,
    updateConfigMeta,
    type ConfigMeta,
  } from '$lib/firebase/configs'

  import CategorySelector from './components/CategorySelector.svelte'
  import UploadForm from './components/UploadForm.svelte'
  import HubListHeader from './components/HubListHeader.svelte'
  import HubList from './components/HubList.svelte'
  import type { Category } from './components/CategorySelector.svelte'
  import type { SortOptionValue } from './components/HubListHeader.svelte'
  import ConfigEditForm from './components/ConfigEditForm.svelte'

  import { BarChart2, User as UserIcon, Activity } from 'lucide-svelte'

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
      Icon: UserIcon,
    },
    {
      key: 'steeze',
      name: 'Steeze',
      subfolder: 'XXLMod3/SteezeCollections',
      Icon: Activity,
    },
  ]

  const SESSION_CATEGORY_KEY = 'communityHubCategoryKey'
  const SESSION_SORT_BY_KEY = 'communityHubSortBy'

  function getInitialCategory(): Category {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const savedKey = sessionStorage.getItem(SESSION_CATEGORY_KEY)
        const foundCategory = categories.find((cat) => cat.key === savedKey)
        if (foundCategory) return foundCategory
      }
    } catch (e) {
      console.error('Error reading category from sessionStorage:', e)
    }
    return categories[0]
  }
  function getInitialSortBy(): SortOptionValue {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const savedSort = sessionStorage.getItem(SESSION_SORT_BY_KEY)
        if (
          savedSort === 'latest' ||
          savedSort === 'downloads' ||
          savedSort === 'likes'
        )
          return savedSort
      }
    } catch (e) {
      console.error('Error reading sort option from sessionStorage:', e)
    }
    return 'latest'
  }

  let editingConfig: ConfigMeta | null = null

  function handleEditRequest(event: CustomEvent<ConfigMeta>) {
    editingConfig = event.detail
  }

  const selectedCategory: Writable<Category> = writable(getInitialCategory())
  const configs = writable<ConfigMeta[]>([])
  const sortBy: Writable<SortOptionValue> = writable(getInitialSortBy())
  const isLoadingList = writable(true)
  const isDownloading = writable<string | null>(null)
  const isDeleting = writable<string | null>(null)

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
            const timeA =
              a.createdAt instanceof Timestamp
                ? a.createdAt.toDate().getTime()
                : 0
            const timeB =
              b.createdAt instanceof Timestamp
                ? b.createdAt.toDate().getTime()
                : 0
            return timeB - timeA
          })
      }
    } catch (e) {
      handleError(e, 'Sorting Configs')
      return $configs
    }
  })

  async function loadConfigs() {
    const currentCategory = get(selectedCategory)
    if (!currentCategory || !currentCategory.key) {
      configs.set([])
      isLoadingList.set(false)
      return
    }
    isLoadingList.set(true)
    try {
      const loadedConfigs = await listConfigMeta(currentCategory.key)
      configs.set(loadedConfigs)
    } catch (e) {
      handleError(e, `Loading ${currentCategory.name} configs`)
      configs.set([])
    } finally {
      isLoadingList.set(false)
    }
  }

  function handleShowDetails(event: CustomEvent<ConfigMeta>) {
    const cfg = event.detail
    openModal({
      title: cfg.fileName,
      message: cfg.description
        ? `<p>${cfg.description}</p>`
        : `<p>No description provided.</p>`,
      confirmOnly: true,
      confirmText: 'Close',
    })
  }

  async function handleDownload(event: CustomEvent<string>) {
    const fileName = event.detail
    isDownloading.set(fileName)
    const currentCategory = get(selectedCategory)
    try {
      const xml = await fetchConfigXml(currentCategory.key, fileName)
      if (xml === null) throw new Error(`Config "${fileName}" not found in hub`)
      const base = get(explorerDirectory)
      if (!base || base.startsWith('/error')) {
        throw new Error(
          'Skater XL directory not set or invalid. Please set it in Settings.',
        )
      }
      const dest = normalizePath(
        await join(base, currentCategory.subfolder, `${fileName}.xml`),
      )
      await writeFile(dest, new TextEncoder().encode(xml))
      await incrementDownloadCount(currentCategory.key, fileName)
      handleSuccess(`Installed to ${dest}`, 'Install')
      setTimeout(loadConfigs, 500)
    } catch (e) {
      handleError(e, `Installing ${fileName}`)
    } finally {
      isDownloading.set(null)
    }
  }

  async function handleToggleLike(event: CustomEvent<string>) {
    const fileName = event.detail
    const user = get(userStore)
    if (!user) {
      handleError(new Error('You must be signed in to like'), 'Auth')
      return
    }
    const currentCategoryKey = get(selectedCategory).key
    try {
      configs.update((currentConfigs) =>
        currentConfigs.map((c) => {
          if (c.fileName === fileName) {
            const currentLikes = c.likesBy || []
            const userIndex = currentLikes.indexOf(user.uid)
            const newLikes =
              userIndex > -1
                ? [
                    ...currentLikes.slice(0, userIndex),
                    ...currentLikes.slice(userIndex + 1),
                  ]
                : [...currentLikes, user.uid]
            return { ...c, likesBy: newLikes }
          }
          return c
        }),
      )
      await toggleLikeConfigXml(currentCategoryKey, fileName)
    } catch (e) {
      handleError(e, `Toggling like for ${fileName}`)
      await loadConfigs()
    }
  }

  function handleDeleteRequest(event: CustomEvent<string>) {
    const fileName = event.detail
    const currentCategoryKey = get(selectedCategory).key
    openModal({
      title: 'Confirm Deletion',
      message: `Are you sure you want to permanently delete "${fileName}.xml"? This cannot be undone.`,
      confirmText: 'Delete Permanently',
      cancelText: 'Cancel',
      confirmClass: 'btn-error',
      onSave: async () => {
        isDeleting.set(fileName)
        try {
          await deleteConfigXml(currentCategoryKey, fileName)
          handleSuccess(`Deleted "${fileName}.xml" from Hub`, 'Delete')
          await loadConfigs()
        } catch (error) {
          handleError(error, `Deleting ${fileName}`)
        } finally {
          isDeleting.set(null)
        }
      },
      onCancel: () => {},
    })
  }

  async function handleSaveEdit(event: CustomEvent<{ description: string }>) {
    // Add null check here
    if (!editingConfig) {
      console.error('handleSaveEdit called but editingConfig is null.')
      handleError(new Error('Cannot save edit: No config selected.'), 'Edit')
      return
    }
    // Store filename *after* null check
    const fileNameToUpdate = editingConfig.fileName
    const currentCategoryKey = get(selectedCategory).key
    const updatedData: Partial<Pick<ConfigMeta, 'description' | 'updatedAt'>> =
      {
        description: event.detail.description,
        // Add updatedAt: serverTimestamp() if your updateConfigMeta handles it
      }
    try {
      // Use the stored filename
      await updateConfigMeta(currentCategoryKey, fileNameToUpdate, updatedData)
      handleSuccess('Config updated successfully!', 'Edit')
      editingConfig = null
      await loadConfigs()
    } catch (error) {
      // Use the stored filename in the catch block as well
      handleError(error, `Updating ${fileNameToUpdate}`)
    }
  }

  function handleCancelEdit() {
    editingConfig = null
  }

  let hasMounted = false
  let categoryUnsubscribe: Unsubscriber
  let sortUnsubscribe: Unsubscriber

  onMount(() => {
    loadConfigs()
    hasMounted = true
    categoryUnsubscribe = selectedCategory.subscribe((value) => {
      if (hasMounted && value && typeof sessionStorage !== 'undefined') {
        try {
          sessionStorage.setItem(SESSION_CATEGORY_KEY, value.key)
        } catch (e) {
          console.error('Error writing category to sessionStorage:', e)
        }
      }
    })
    sortUnsubscribe = sortBy.subscribe((value) => {
      if (hasMounted && value && typeof sessionStorage !== 'undefined') {
        try {
          sessionStorage.setItem(SESSION_SORT_BY_KEY, value)
        } catch (e) {
          console.error('Error writing sort option to sessionStorage:', e)
        }
      }
    })
  })

  onDestroy(() => {
    if (categoryUnsubscribe) categoryUnsubscribe()
    if (sortUnsubscribe) sortUnsubscribe()
  })

  $: if ($selectedCategory && hasMounted) {
    loadConfigs()
  }
</script>

<div class="flex h-full w-full flex-col gap-4 px-4 pb-4 md:flex-row">
  <aside class="flex w-full flex-shrink-0 flex-col gap-4 md:h-full md:w-1/3">
    <CategorySelector
      {categories}
      selectedCategory={$selectedCategory}
      disabled={$isDownloading !== null ||
        $isDeleting !== null ||
        editingConfig !== null}
      on:categoryChange={(e) => selectedCategory.set(e.detail)}
    />
    <UploadForm
      selectedCategory={$selectedCategory}
      user={$userStore}
      isDeleting={$isDeleting !== null}
      on:uploadComplete={loadConfigs}
    />
  </aside>

  <main
    class="bg-base-100 rounded-box flex h-full min-h-0 w-full flex-col p-4 shadow-md md:w-2/3"
  >
    {#if editingConfig}
      <ConfigEditForm
        config={editingConfig}
        on:save={handleSaveEdit}
        on:cancel={handleCancelEdit}
      />
    {:else}
      <HubListHeader
        selectedCategoryName={$selectedCategory.name}
        sortBy={$sortBy}
        isLoading={$isLoadingList}
        isDeleting={$isDeleting !== null}
        on:sortChange={(e) => sortBy.set(e.detail)}
      />
      <div class="divider m-0"></div>
      <HubList
        configs={$sortedConfigs}
        selectedCategory={$selectedCategory}
        isLoading={$isLoadingList}
        isDownloading={$isDownloading}
        isDeleting={$isDeleting}
        user={$userStore}
        explorerDirectory={$explorerDirectory}
        on:download={handleDownload}
        on:toggleLike={handleToggleLike}
        on:delete={handleDeleteRequest}
        on:showDetails={handleShowDetails}
        on:edit={handleEditRequest}
      />
    {/if}
  </main>
</div>

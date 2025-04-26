<script lang="ts">
  import { normalizePath } from '$lib/services/pathService'
  import {
    setPath as navigateToPath,
    currentPath as currentPathStore,
  } from '$lib/stores/explorerStore'
  import { handleError } from '$lib/utils/errorHandler'
  import { CornerRightUp } from 'lucide-svelte'

  export let currentPath: string | null | undefined = ''
  export let absoluteBasePath: string = ''

  interface PathSegment {
    name: string
    fullPath: string
    isNavigable: boolean
  }

  let pathSegments: PathSegment[] = []
  let canGoBack = false

  $: {
    const normCurrent = normalizePath(currentPath || '')
    const normBase = normalizePath(absoluteBasePath || '')
    const segments: PathSegment[] = []

    if (normCurrent && normBase && normCurrent.startsWith(normBase)) {
      const relativeToBase = normCurrent
        .substring(normBase.length)
        .replace(/^[\/\\]/, '')
      let accumulatedPath = normBase
      const baseFolderName = normBase.split('/').pop() || 'Base'
      segments.push({
        name: baseFolderName,
        fullPath: normBase,
        isNavigable: true,
      })

      relativeToBase.split('/').forEach((part) => {
        if (part) {
          accumulatedPath = `${accumulatedPath}/${part}`
          segments.push({
            name: part,
            fullPath: accumulatedPath,
            isNavigable: true,
          })
        }
      })
    } else if (normCurrent) {
      if (normBase) {
        const baseFolderName = normBase.split('/').pop() || 'Base'
        segments.push({
          name: baseFolderName,
          fullPath: normBase,
          isNavigable: false,
        })
      } else {
        segments.push({ name: 'Error', fullPath: '#', isNavigable: false })
      }
    } else {
      segments.push({ name: 'Loading...', fullPath: '#', isNavigable: false })
    }
    pathSegments = segments
  }

  $: canGoBack =
    !!normalizePath(currentPath || '') &&
    !!normalizePath(absoluteBasePath || '') &&
    normalizePath(currentPath || '') !== normalizePath(absoluteBasePath || '')

  async function handleGoBack() {
    const curr = $currentPathStore
    if (!curr || !canGoBack) return
    try {
      const pathParts = curr.split(/[\/\\]/).filter(Boolean)
      const parentPath = pathParts.slice(0, -1).join('/') || '/'
      await navigateToPath(normalizePath(parentPath))
    } catch (error) {
      handleError(error, 'Going back')
    }
  }

  function handleSegmentClick(segment: PathSegment) {
    if (
      segment.isNavigable &&
      segment.fullPath &&
      normalizePath(segment.fullPath) !== normalizePath(currentPath || '')
    ) {
      navigateToPath(segment.fullPath)
    }
  }
</script>

<div class="flex items-center space-x-2 text-sm">
  <button
    class="btn btn-ghost btn-xs flex-shrink-0 px-2 disabled:opacity-50"
    data-tip="Go up one level"
    on:click={handleGoBack}
    disabled={!canGoBack}
    aria-label="Go up one level"
  >
    <CornerRightUp class="h-4 w-4" />
  </button>

  <div class="z-10 flex items-center overflow-hidden" aria-label="Breadcrumb">
    {#each pathSegments as segment, index (segment.fullPath + index)}
      {#if index > 0}
        <span class="text-base-content/50 mx-1 flex-shrink-0">/</span>
      {/if}

      {#if segment.isNavigable && index < pathSegments.length - 1}
        <button
          class="text-base-content/60 hover:text-base-content cursor-pointer"
          on:click={() => handleSegmentClick(segment)}
        >
          {segment.name}
        </button>
      {:else}
        <button
          class:font-semibold={index === pathSegments.length - 1}
          class="text-base-content cursor-default"
        >
          {segment.name}
        </button>
      {/if}
    {/each}
  </div>
</div>

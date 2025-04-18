<!-- src/lib/features/explorer/components/PathHeader.svelte -->
<script lang="ts">
  import { normalizePath } from '$lib/services/pathService'
  import { setPath as navigateToPath } from '$lib/stores/explorerStore'

  // Props passed down from the parent (e.g., ExplorerLayout).
  export let currentPath: string | null | undefined = ''
  export let onGoBack: () => void
  export let absoluteBasePath: string = ''

  interface PathSegment {
    name: string
    fullPath: string
    isNavigable: boolean
  }

  let pathSegments: PathSegment[] = []
  let canGoBack = false

  // Use fallback empty string when values are falsy.
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
    on:click={onGoBack}
    disabled={!canGoBack}
    aria-label="Go up one level"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="1.5"
      stroke="currentColor"
      class="w-4 h-4"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M9 9l6-6m0 0l6 6m-6-6v12a6 6 0 01-12 0v-3"
      />
    </svg>
  </button>

  <div class="flex items-center overflow-hidden z-10" aria-label="Breadcrumb">
    {#each pathSegments as segment, index (segment.fullPath + index)}
      {#if index > 0}
        <span class="mx-1 text-base-content/50 flex-shrink-0">/</span>
      {/if}

      {#if segment.isNavigable && index < pathSegments.length - 1}
        <button
          class="cursor-pointer text-base-content/60 hover:text-base-content"
          on:click={() => handleSegmentClick(segment)}
        >
          {segment.name}
        </button>
      {:else}
        <button
          class="cursor-pointer"
          class:font-semibold={index === pathSegments.length - 1}
          class:text-base-content={true}
          class:cursor-default={!segment.isNavigable ||
            index === pathSegments.length - 1}
        >
          {segment.name}
        </button>
      {/if}
    {/each}
  </div>
</div>

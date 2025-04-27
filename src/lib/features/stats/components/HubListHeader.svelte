<script context="module" lang="ts">
  // Types exported from the module context are importable by other components
  export type SortOptionValue = 'latest' | 'downloads' | 'likes'

  export type SortOption = {
    label: string
    value: SortOptionValue
  }
</script>

<script lang="ts">
  // Runtime logic and props for the component instance
  import { createEventDispatcher } from 'svelte'
  // SortOptionValue and SortOption types are available here from the module script

  export let selectedCategoryName: string
  export let sortBy: SortOptionValue
  export let isLoading: boolean = false
  export let isDeleting: boolean = false

  const sortOptions: SortOption[] = [
    { label: 'Latest', value: 'latest' },
    { label: 'Downloads', value: 'downloads' },
    { label: 'Likes', value: 'likes' },
  ]

  const dispatch = createEventDispatcher()

  function selectSort(value: SortOptionValue) {
    if (isLoading || isDeleting) return
    dispatch('sortChange', value)
  }

  $: hoverEnabled = (optValue: SortOptionValue) =>
    sortBy !== optValue && !(isLoading || isDeleting)
</script>

<div
  class="mb-3 flex flex-shrink-0 flex-wrap items-center justify-between gap-3"
>
  <h3 class="text-base font-medium">
    Community Hub: {selectedCategoryName}
  </h3>
  <div class="flex items-center gap-2">
    {#each sortOptions as opt (opt.value)}
      <button
        type="button"
        class="transition-colors duration-150 ease-in-out"
        class:badge={true}
        class:badge-primary={sortBy === opt.value}
        class:badge-outline={sortBy !== opt.value}
        class:cursor-pointer={!(isLoading || isDeleting)}
        class:opacity-50={isLoading || isDeleting}
        class:hover:bg-base-content={hoverEnabled(opt.value)}
        class:hover:text-base-100={hoverEnabled(opt.value)}
        class:hover:border-base-content={hoverEnabled(opt.value)}
        on:click={() => selectSort(opt.value)}
        disabled={isLoading || isDeleting}
      >
        {opt.label}
      </button>
    {/each}
  </div>
</div>

<script context="module" lang="ts">
  export type SortOption = { label: string; value: string }
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { RefreshCw } from 'lucide-svelte' // Requires: bun add lucide-svelte

  export let title: string
  export let searchQuery: string
  export let sortOptions: SortOption[]
  export let sortOrder: string
  export let disabled: boolean = false
  export let refreshing: boolean = false

  const dispatch = createEventDispatcher<{
    search: string
    sort: string
    refresh: void
  }>()

  function onSearch(e: Event) {
    const q = (e.target as HTMLInputElement).value
    dispatch('search', q)
  }

  function onSort(v: string) {
    dispatch('sort', v)
  }

  $: isDisabled = disabled || refreshing
</script>

<div class="flex flex-wrap items-center gap-4">
  <h2 class="mr-4 text-xl font-bold">{title}</h2>

  <div class="flex flex-wrap items-center gap-2">
    {#each sortOptions as opt}
      <button
        type="button"
        class="badge badge-sm transition-colors {isDisabled
          ? 'pointer-events-none opacity-50'
          : 'cursor-pointer'} {sortOrder === opt.value
          ? 'badge-primary'
          : 'badge-outline hover:bg-base-content hover:text-base-100 hover:border-base-content'}"
        on:click={() => !isDisabled && onSort(opt.value)}
        disabled={isDisabled}
      >
        {opt.label}
      </button>
    {/each}
  </div>

  <div class="min-w-[1rem] flex-1"></div>

  <button
    class="btn btn-ghost btn-sm btn-square {refreshing ? 'loading' : ''}"
    aria-label="Refresh {title}"
    title="Refresh {title}"
    disabled={isDisabled}
    on:click={() => dispatch('refresh')}
  >
    {#if !refreshing}
      <RefreshCw size={18} />
    {/if}
  </button>

  <input
    type="text"
    placeholder="Search…"
    class="input input-sm input-bordered w-full sm:w-64"
    bind:value={searchQuery}
    on:input={onSearch}
    disabled={isDisabled}
  />
</div>

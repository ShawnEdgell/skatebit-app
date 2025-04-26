<script context="module" lang="ts">
  // Shared type for toolbar sort options
  export type SortOption = { label: string; value: string }
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  export let title: string
  export let searchQuery: string
  export let sortOptions: SortOption[]
  export let sortOrder: string
  export let disabled: boolean = false

  const dispatch = createEventDispatcher<{ search: string; sort: string }>()

  function onSearch(e: Event) {
    const q = (e.target as HTMLInputElement).value
    dispatch('search', q)
  }

  function onSort(v: string) {
    dispatch('sort', v)
  }
</script>

<div class="flex items-center gap-4">
  <h2 class="text-2xl font-bold">{title}</h2>

  <div class="flex flex-wrap gap-2">
    {#each sortOptions as opt}
      <button
        type="button"
        class={`badge cursor-pointer transition-colors
          ${
            sortOrder === opt.value
              ? 'badge-primary'
              : 'badge-outline hover:bg-base-content hover:text-base-100 hover:border-base-content'
          }`}
        on:click={() => onSort(opt.value)}
        {disabled}
      >
        {opt.label}
      </button>
    {/each}
  </div>

  <div class="flex-1"></div>

  <input
    type="text"
    placeholder="Search…"
    class="input input-sm input-bordered w-64"
    bind:value={searchQuery}
    on:input={onSearch}
    {disabled}
  />
</div>

<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  export let sortOptions: { label: string; value: string }[] = []
  export let selectedSort: string
  export let loading: boolean = false

  const dispatch = createEventDispatcher()

  function handleClick(sortValue: string) {
    if (!loading && sortValue !== selectedSort) {
      dispatch('selectSort', sortValue)
    }
  }
</script>

<div class="flex items-center gap-2 flex-wrap">
  <h2 class="text-2xl mr-2 font-bold">Mod.io Maps</h2>
  {#each sortOptions as option}
    <button
      type="button"
      class="badge cursor-pointer transition-colors {selectedSort ===
      option.value
        ? 'badge-primary'
        : 'badge-outline hover:bg-base-content hover:text-base-100 hover:border-base-content'}"
      on:click={() => handleClick(option.value)}
      disabled={loading}
    >
      {option.label}
    </button>
  {/each}
</div>

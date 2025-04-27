<script context="module" lang="ts">
  import type { SvelteComponent } from 'svelte'
  export type Category = {
    key: string
    name: string
    subfolder: string
    Icon: typeof SvelteComponent
  }
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  // Removed type definition from here

  // Props received from the parent
  export let categories: Category[]
  export let selectedCategory: Category
  export let disabled: boolean = false

  const dispatch = createEventDispatcher()

  // Handle selection change and dispatch the new value
  function handleChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement
    // Find the category object corresponding to the selected value's key
    const newSelectedCategory = categories.find(
      (cat) => cat.key === selectElement.value,
    )
    if (newSelectedCategory) {
      // Dispatch the full category object
      dispatch('categoryChange', newSelectedCategory)
    }
  }
</script>

<div class="bg-base-100 rounded-box flex-shrink-0 p-4 shadow-md">
  <h3 class="mb-2 font-medium">Select Category</h3>
  <select
    id="category-select"
    class="select select-bordered select-sm w-full"
    value={selectedCategory.key}
    {disabled}
    on:change={handleChange}
  >
    {#each categories as cat (cat.key)}
      <option value={cat.key}>{cat.name}</option>
    {/each}
  </select>
</div>

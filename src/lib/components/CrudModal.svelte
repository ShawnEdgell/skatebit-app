<!-- src/lib/components/CrudModal.svelte -->
<script lang="ts">
  import { createEventDispatcher } from "svelte";

  // Props for modal configuration.
  export let open: boolean = false;
  export let title: string = "";
  export let placeholder: string = "";
  export let initialValue: string = "";
  export let confirmOnly: boolean = false;

  const dispatch = createEventDispatcher();

  let inputValue = initialValue;

  // When the modal becomes open, reset the input.
  $: if (open) {
    inputValue = initialValue;
  }

  function save() {
    // If confirmOnly, dispatch empty string or a fixed value.
    dispatch("save", { value: confirmOnly ? "" : inputValue });
    open = false;
  }

  function cancel() {
    dispatch("cancel");
    open = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!confirmOnly && event.key === "Enter") {
      event.preventDefault();
      save();
    }
  }
</script>

{#if open}
  <div class="modal modal-open">
    <div class="modal-box relative">
      <button type="button" on:click={cancel} class="btn btn-sm btn-circle absolute right-2 top-2" aria-label="Close modal">
        ✕
      </button>
      <h3 class="text-lg font-bold mb-4">{title}</h3>
      
      {#if !confirmOnly}
        <input
          type="text"
          placeholder={placeholder}
          bind:value={inputValue}
          on:keydown={handleKeydown}
          class="input input-bordered w-full mb-4"
        />
      {/if}
      
      <div class="modal-action">
        <button type="button" class="btn btn-secondary" on:click={cancel}>Cancel</button>
        <button type="button" class="btn btn-primary" on:click={save}>OK</button>
      </div>
    </div>
  </div>
{/if}

<script lang="ts">
  import { modalStore, closeModal } from '$lib/stores/modalStore';
  import type { ModalProps } from '$lib/stores/modalStore';
  import { onDestroy } from 'svelte';

  let currentProps: ModalProps;
  const unsubscribe = modalStore.subscribe((value: ModalProps) => {
    currentProps = value;
  });

  onDestroy(unsubscribe);

  function handleSave() {
    currentProps.onSave?.(currentProps.inputValue ?? "");
    closeModal();
  }

  function handleCancel() {
    currentProps.onCancel?.();
    closeModal();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!currentProps.confirmOnly && event.key === "Enter") {
      event.preventDefault();
      handleSave();
    } else if (event.key === 'Escape') {
      handleCancel();
    }
  }

  $: inputValue = currentProps.inputValue;
  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    modalStore.update((state: ModalProps) => ({ ...state, inputValue: target.value }));
  }

</script>

{#if currentProps?.open}
  <!-- svelte-ignore a11y-autofocus -->
  <dialog class="modal modal-open h-full w-full content-center justify-center" on:close={handleCancel} on:keydown={handleKeydown}>
    <div class="modal-box min-w-md max-w-xl">
      <button type="button" on:click={handleCancel} class="btn btn-sm btn-circle absolute right-2 top-2" aria-label="Close modal">✕</button>
      <h3 class="text-lg font-bold mb-4">{currentProps.title}</h3>

      {#if currentProps.message}
        <p class="mb-4 whitespace-pre-wrap">{currentProps.message}</p>
      {/if}

      {#if !currentProps.confirmOnly}
        <input
          type="text"
          placeholder={currentProps.placeholder}
          value={inputValue ?? ""}
          on:input={handleInput}
          class="input input-bordered w-full mb-4"
          autofocus={!currentProps.confirmOnly}
        />
      {/if}

      <div class="modal-action">
        <button type="button" class="btn btn-ghost" on:click={handleCancel}>
            {currentProps.cancelText ?? 'Cancel'}
        </button>
        <button
          type="button"
          class="btn {currentProps.confirmClass ?? (currentProps.confirmOnly ? 'btn-primary' : 'btn-primary')}"
          on:click={handleSave}
        >
            {currentProps.confirmText ?? (currentProps.confirmOnly ? 'Confirm' : 'OK')}
        </button>
      </div>
    </div>
     <form method="dialog" class="modal-backdrop">
       <button type="button" on:click={handleCancel}>close</button>
     </form>
  </dialog>
{/if}
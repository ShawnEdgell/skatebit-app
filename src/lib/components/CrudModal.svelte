<!-- src/lib/components/CrudModal.svelte -->
<script lang="ts">
  import { modalStore, closeModal } from '$lib/stores/uiStore';

  $: currentProps = $modalStore;

  // When the modal opens, if inputValue is not yet set but we have an initialValue,
  // update inputValue to match initialValue.
  $: if ($modalStore.open && !$modalStore.inputValue && $modalStore.initialValue) {
    modalStore.update(n => ({ ...n, inputValue: n.initialValue }));
  }
  
  // Confirmation mode is active if placeholder equals "free dawg"
  $: isConfirmationMode = $modalStore.placeholder === "free dawg";
  // Disable confirm until input exactly matches "free dawg" in confirmation mode.
  $: isConfirmDisabled = isConfirmationMode
      ? ($modalStore.inputValue !== "free dawg")
      : false;

  function handleSave() {
    if (isConfirmationMode && $modalStore.inputValue !== "free dawg") {
      return;
    }
    currentProps.onSave?.(currentProps.inputValue ?? "");
    closeModal();
  }
  function handleCancel() {
    currentProps.onCancel?.();
    closeModal();
  }
  async function handleSecondary() {
    if (currentProps.onSecondary) {
      await currentProps.onSecondary();
      closeModal();
    }
  }
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSave();
    } else if (event.key === 'Escape') {
      handleCancel();
    }
  }
</script>

{#if $modalStore.open}
  <dialog class="modal modal-open h-full w-screen content-center justify-center p-0 z-100 fixed inset-0" on:close={handleCancel} on:keydown={handleKeydown}>
    <div class="modal-box min-w-md max-w-xl p-6">
      <button type="button" on:click={handleCancel} class="btn btn-sm btn-circle absolute right-2 top-2" aria-label="Close modal">✕</button>
      <h3 class="text-2xl font-bold mb-4 break-words">{$modalStore.title}</h3>
      {#if $modalStore.message}
        <div class="mb-4 whitespace-pre-wrap break-words">
          {@html $modalStore.message}
        </div>
      {/if}
      {#if $modalStore.placeholder || $modalStore.initialValue}
        <input type="text" placeholder={$modalStore.placeholder ?? ''} bind:value={$modalStore.inputValue} class="input input-bordered w-full break-words" />
      {/if}
      <div class="modal-action flex items-center">
        <!-- Left container: secondary action -->
        <div class="flex-grow">
          {#if $modalStore.secondaryText && $modalStore.onSecondary}
            <button type="button" class="btn btn-secondary" on:click={handleSecondary} disabled={isConfirmDisabled}>
              {$modalStore.secondaryText}
            </button>
          {/if}
        </div>
        <!-- Right container: Cancel and Confirm buttons -->
        <div class="flex space-x-2">
          {#if !$modalStore.confirmOnly}
            <button type="button" class="btn btn-ghost" on:click={handleCancel}>
              {$modalStore.cancelText ?? 'Cancel'}
            </button>
          {/if}
          <button type="button" class="btn {$modalStore.confirmClass ?? 'btn-primary'}" on:click={handleSave} disabled={isConfirmDisabled}>
            {$modalStore.confirmText ?? ($modalStore.confirmOnly ? 'OK' : 'Save')}
          </button>
        </div>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop w-screen fixed inset-0">
      <button type="button" on:click={handleCancel}>close</button>
    </form>
  </dialog>
{/if}

<script lang="ts">
  import { modalStore, closeModal } from '$lib/stores/uiStore'

  $: if (
    $modalStore.open &&
    !$modalStore.inputValue &&
    $modalStore.initialValue
  ) {
    modalStore.update((n) => ({ ...n, inputValue: n.initialValue }))
  }

  $: isConfirmDisabled =
    $modalStore.placeholder === 'free dawg' &&
    $modalStore.inputValue !== 'free dawg'

  function handleSave() {
    if (isConfirmDisabled) {
      return
    }
    $modalStore.onSave?.($modalStore.inputValue ?? '')
    closeModal()
  }

  function handleCancel() {
    $modalStore.onCancel?.()
    closeModal()
  }

  async function handleSecondary() {
    if ($modalStore.onSecondary) {
      await $modalStore.onSecondary()
      closeModal()
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !isConfirmDisabled) {
      event.preventDefault()
      handleSave()
    } else if (event.key === 'Escape') {
      handleCancel()
    }
  }
</script>

{#if $modalStore.open}
  <dialog
    class="modal modal-open fixed inset-0 z-100 h-full w-screen content-center justify-center p-0"
    on:close={handleCancel}
    on:keydown={handleKeydown}
  >
    <div class="modal-box max-w-lg min-w-md p-4">
      <button
        type="button"
        on:click={handleCancel}
        class="btn btn-sm btn-circle absolute top-2 right-2"
        aria-label="Close modal">✕</button
      >
      <h3 class="mb-3 text-lg font-bold break-words">{$modalStore.title}</h3>
      {#if $modalStore.message}
        <div class="mb-3 text-sm break-words whitespace-pre-wrap">
          {@html $modalStore.message}
        </div>
      {/if}
      {#if $modalStore.placeholder || $modalStore.initialValue}
        <input
          type="text"
          placeholder={$modalStore.placeholder ?? ''}
          bind:value={$modalStore.inputValue}
          class="input input-sm input-bordered w-full break-words"
        />
      {/if}
      <div class="modal-action mt-4 flex items-center">
        <div class="flex-grow">
          {#if $modalStore.secondaryText && $modalStore.onSecondary}
            <button
              type="button"
              class="btn btn-sm btn-secondary"
              on:click={handleSecondary}
              disabled={isConfirmDisabled}
            >
              {$modalStore.secondaryText}
            </button>
          {/if}
        </div>
        <div class="flex space-x-2">
          {#if !$modalStore.confirmOnly}
            <button type="button" class="btn btn-sm btn-ghost" on:click={handleCancel}>
              {$modalStore.cancelText ?? 'Cancel'}
            </button>
          {/if}
          <button
            type="button"
            class="btn btn-sm {$modalStore.confirmClass ?? 'btn-primary'}"
            on:click={handleSave}
            disabled={isConfirmDisabled}
          >
            {$modalStore.confirmText ??
              ($modalStore.confirmOnly ? 'OK' : 'Save')}
          </button>
        </div>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop fixed inset-0 w-screen">
      <button type="button" on:click={handleCancel}>close</button>
    </form>
  </dialog>
{/if}

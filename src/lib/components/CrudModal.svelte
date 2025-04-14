<script lang="ts">
	import { modalStore, closeModal } from '$lib/stores/modalStore';
	import type { ModalProps } from '$lib/stores/modalStore';
	import { onDestroy } from 'svelte';

	// Use $: syntax for reactive subscription to the store
	$: currentProps = $modalStore;

	// No need for manual subscribe/unsubscribe with $:
	// onDestroy(unsubscribe);

	function handleSave() {
        // Check if input was intended before passing value
        const shouldHaveInput = currentProps.placeholder || currentProps.initialValue;
		currentProps.onSave?.(shouldHaveInput ? (currentProps.inputValue ?? "") : ""); // Pass empty string if no input expected
		closeModal();
	}

	function handleCancel() {
		currentProps.onCancel?.();
		closeModal();
	}

	function handleKeydown(event: KeyboardEvent) {
        // Check if input is shown before allowing Enter key
        const shouldHaveInput = currentProps.placeholder || currentProps.initialValue;
		if (shouldHaveInput && event.key === 'Enter') {
			event.preventDefault();
			handleSave();
		} else if (event.key === 'Escape') {
			handleCancel();
		}
	}

    // Remove local inputValue, bind directly to store value
	// $: inputValue = currentProps.inputValue;
	// function handleInput(event: Event) { ... } // Use bind:value instead

</script>

<!-- Use $modalStore directly -->
{#if $modalStore.open}
	<!-- svelte-ignore a11y-autofocus -->
	<dialog
		class="modal modal-open h-full w-full content-center justify-center"
		on:close={handleCancel}
		on:keydown={handleKeydown}
	>
		<div class="modal-box min-w-md max-w-xl">
			<button
				type="button"
				on:click={handleCancel}
				class="btn btn-sm btn-circle absolute right-2 top-2"
				aria-label="Close modal">✕</button>
			<h3 class="text-lg font-bold mb-4">{$modalStore.title}</h3>

			{#if $modalStore.message}
				<p class="mb-4 whitespace-pre-wrap">{$modalStore.message}</p>
			{/if}

			<!-- *** UPDATED CONDITION FOR INPUT *** -->
			{#if $modalStore.placeholder || $modalStore.initialValue}
				<input
					type="text"
					placeholder={$modalStore.placeholder ?? ''}
                    bind:value={$modalStore.inputValue}  
					class="input input-bordered w-full mb-4"
                    autofocus 
				/>
			{/if}
            <!-- *** END UPDATE *** -->

			<div class="modal-action">
                <!-- Show cancel unless confirmOnly is explicitly true -->
				{#if !$modalStore.confirmOnly}
					<button type="button" class="btn btn-ghost" on:click={handleCancel}>
						{$modalStore.cancelText ?? 'Cancel'}
					</button>
				{/if}
				<button
					type="button"
					class="btn {$modalStore.confirmClass ?? 'btn-primary'}"
					on:click={handleSave}
				>
                    <!-- Simplified button text logic -->
					{$modalStore.confirmText ?? ($modalStore.confirmOnly ? 'OK' : 'Save')}
				</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button type="button" on:click={handleCancel}>close</button>
		</form>
	</dialog>
{/if}
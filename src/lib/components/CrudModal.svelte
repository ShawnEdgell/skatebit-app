<script lang="ts">
	import { modalStore, closeModal } from '$lib/stores/modalStore';
	import type { ModalProps } from '$lib/stores/modalStore';
	import { onDestroy } from 'svelte';

	// Reactive subscription to modalStore
	$: currentProps = $modalStore;

	// Determine if we're in "confirmation mode" by checking whether the placeholder equals the required phrase.
	$: isConfirmationMode = $modalStore.placeholder === "I understand";

	// Disable confirm if in confirmation mode and the typed input does not match.
	$: isConfirmDisabled = isConfirmationMode 
		? ($modalStore.inputValue !== "I understand")
		: false;

	function handleSave() {
		// If in confirmation mode, ensure the user typed exactly the confirmation phrase.
		if (isConfirmationMode && $modalStore.inputValue !== "I understand") {
			// Optionally, add an error message here before returning.
			return;
		}

		// Otherwise, if an input is expected, pass it along.
		const shouldHaveInput = $modalStore.placeholder || $modalStore.initialValue;
		currentProps.onSave?.(shouldHaveInput ? ($modalStore.inputValue ?? "") : "");
		closeModal();
	}

	function handleCancel() {
		currentProps.onCancel?.();
		closeModal();
	}

	function handleKeydown(event: KeyboardEvent) {
		// Check if an input is expected (whether for confirmation or generic input).
		const shouldHaveInput = $modalStore.placeholder || $modalStore.initialValue;
		if (shouldHaveInput && event.key === 'Enter') {
			event.preventDefault();
			handleSave();
		} else if (event.key === 'Escape') {
			handleCancel();
		}
	}
</script>

{#if $modalStore.open}
	<!-- svelte-ignore a11y-autofocus -->
	<dialog
		class="modal modal-open h-full w-screen content-center justify-center p-0 z-100 fixed inset-0"
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

			<!-- Render an input if either placeholder or initialValue is provided -->
			{#if $modalStore.placeholder || $modalStore.initialValue}
				<input
					type="text"
					placeholder={$modalStore.placeholder ?? ''}
					bind:value={$modalStore.inputValue}
					class="input input-bordered w-full mb-4"
					autofocus
				/>
			{/if}

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
					disabled={isConfirmDisabled}
				>
					{$modalStore.confirmText ?? ($modalStore.confirmOnly ? 'OK' : 'Save')}
				</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop w-screen fixed inset-0">
			<button type="button" on:click={handleCancel}>close</button>
		</form>
	</dialog>
{/if}

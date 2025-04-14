<script lang="ts">
	// Make sure these props are declared in your actual component script
	export let tabs: { label: string; subfolder: string; icon: string }[] = [];
	export let currentPath: string;
	export let onSwitchTab: (subfolder: string) => void;
	export let baseFolder: string;

	// And this helper function
	import { normalizePath } from '$lib/ts/pathUtils'; // Adjust path if needed
	$: normalizedCurrentPath = currentPath ? normalizePath(currentPath) : '';
</script>

<div class="w-64">
<!-- Vertical Button Group - Base container -->
<div class="flex flex-col items-center space-y-1 p-2 bg-base-200 rounded-box shadow-md">
	{#each tabs as tab (tab.subfolder)}
		{@const expectedPath = normalizePath(`${baseFolder}/${tab.subfolder}`)}
		{@const isActive = normalizedCurrentPath === expectedPath}
		<button
			type="button"
			class="btn btn-ghost w-full h-auto p-2 justify-start" 
			class:btn-active={isActive} 
			class:bg-primary={isActive} 
            class:text-primary-content={isActive} 
			on:click={() => onSwitchTab(tab.subfolder)}
			title={tab.label}
		>
			<span class="flex items-center gap-2 text-lg">
				{@html tab.icon}
				<span class="text-sm font-medium normal-case">{tab.label}</span> 
			</span>
		</button>
	{/each}
</div>
</div>
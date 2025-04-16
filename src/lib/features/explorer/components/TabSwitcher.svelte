<script lang="ts">
	import { normalizePath } from '$lib/services/pathService'
	
	$: normalizedCurrentPath = currentPath ? normalizePath(currentPath) : '';

	export let tabs: { label: string; subfolder: string; icon: string }[] = [];
	export let currentPath: string;
	export let onSwitchTab: (subfolder: string) => void;
	export let baseFolder: string;	
</script>

<section>
<div class="flex flex-col items-center space-y-1 p-2 bg-base-200 rounded-box shadow-md w-64 z-10">
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
</section>
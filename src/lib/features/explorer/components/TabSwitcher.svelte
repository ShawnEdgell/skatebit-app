<!-- src/lib/features/explorer/components/TabSwitcher.svelte -->
<script lang="ts">
  import { normalizePath } from '$lib/services/pathService'
  import { isMapsSymlinked } from '$lib/stores/globalPathsStore'

  export let tabs: { label: string; subfolder: string; icon: string }[] = [],
    currentPath: string = '',
    baseFolder: string = '',
    onSwitchTab: (subfolder: string) => void

  // normalize once per render
  $: normalizedCurrentPath = normalizePath(currentPath)
</script>

<section>
  <div
    class="flex flex-col items-center space-y-1 p-2 bg-base-200 rounded-box shadow-md w-64 z-10"
  >
    {#each tabs as tab (tab.subfolder)}
      {@const expectedPath = normalizePath(`${baseFolder}/${tab.subfolder}`)}
      {@const isActive = normalizedCurrentPath === expectedPath}

      <button
        type="button"
        class="btn btn-ghost w-full h-auto p-2 justify-between"
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

        {#if tab.subfolder === 'Maps' && $isMapsSymlinked}
          <svg
            class="h-4 w-4 text-info"
            viewBox="0 0 16 16"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M7.0503 1.5355c0.9832-0.9832 2.3167-1.5355 3.7072-1.5355 2.8954 0 5.2426 2.3472 5.2426 5.2426 0 1.3904-0.5523 2.7238-1.5355 3.7071l-2.0503 2.0503L11 9.5858l2.0503-2.0503c0.6081-0.6081 1-1.4329 1-2.2929 0-1.7909-1.4518-3.2426-3.2426-3.2426-0.86 0-1.6848 0.3416-2.2929 0.9497L6.4142 5 5 3.5858l2.0503-2.0503Z"
            />
            <path
              d="M7.5355 13.0503l2.0503-2.0503L11 12.4142l-2.0503 2.0503c-0.9832 0.9832-2.3166 1.5355-3.7071 1.5355C2.3472 16 0 13.6528 0 10.7574 0 9.3669 0.5523 8.0334 1.5355 7.0503L3.5858 5 5 6.4142 2.9497 8.4645c-0.6081 0.6081-1 1.4329-1 2.2929 0 1.7909 1.4518 3.2426 3.2426 3.2426 0.86 0 1.6848-0.3416 2.2929-0.9497Z"
            />
            <path
              d="M5.7071 11.7071L11.7071 5.7071 10.2929 4.2929 4.2929 10.2929 5.7071 11.7071Z"
            />
          </svg>
        {/if}
      </button>
    {/each}
  </div>
</section>

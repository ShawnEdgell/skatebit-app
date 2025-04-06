<script lang="ts">
  export let tabs: { label: string; subfolder: string }[] = [];
  export let currentPath: string;
  export let onSwitchTab: (subfolder: string) => void;
  export let baseFolder: string;
</script>

<div class="tabs tabs-box flex justify-center rounded-none ">
  {#each tabs as tab}
    <button 
      class="tab tab-bordered {currentPath === `${baseFolder}/${tab.subfolder}` ? 'tab-active' : ''}"
      on:click={() => onSwitchTab(tab.subfolder)}>
      {tab.label}
    </button>
  {/each}
</div>
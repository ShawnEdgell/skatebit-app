<!-- src/lib/components/ModalManager.svelte -->
<script lang="ts">
  import { modalStore } from "$lib/stores/modalStore";
  import CrudManager from "./CrudManager.svelte";
</script>

{#if $modalStore.open && $modalStore.type === "crud"}
  {#key $modalStore.props.action + "-" + $modalStore.props.currentName}
    <CrudManager
      bind:open={$modalStore.open}
      action={$modalStore.props.action}
      currentPath={$modalStore.props.currentPath}
      currentName={$modalStore.props.currentName}
      on:crudSuccess={() =>
        modalStore.set({ open: false, type: null, props: { action: "rename", currentPath: "", currentName: "" } })
      }
      on:crudCancel={() =>
        modalStore.set({ open: false, type: null, props: { action: "rename", currentPath: "", currentName: "" } })
      } />
  {/key}
{/if}

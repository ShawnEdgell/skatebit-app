<script lang="ts">
    import "../app.css";
    import NavBar from "$lib/components/NavBar.svelte";
</script>

<div class="w-full h-full flex flex-col items-center">
    <NavBar />
    <div class="p-4 prose lg:prose-2xl w-full">
          <slot />
    </div>
</div>
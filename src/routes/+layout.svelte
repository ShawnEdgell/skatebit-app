<script lang="ts">
    import "../app.css";
    import NavBar from "$lib/components/NavBar.svelte";
    import Toast from "$lib/components/Toast.svelte";
</script>


<Toast />
<NavBar />
<div class="p-4">
    <slot />
</div>


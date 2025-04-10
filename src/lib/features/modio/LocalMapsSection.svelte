<script lang="ts">
  import { localMapsStore } from '$lib/stores/localMaps';
  import { LocalMapList } from './components';
  $: localMaps = $localMapsStore;
</script>

<section>
  <h2 class="text-2xl font-bold mb-4">Local Maps</h2>
  <LocalMapList localMaps={localMaps} loading={false} />
</section>

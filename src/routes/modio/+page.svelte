<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { db } from '$lib/firebase/firebase';
  import { doc, getDoc } from 'firebase/firestore';
  import type { Mod } from '$lib/types/modio';
  import { DISPLAY_PAGE_SIZE } from '$lib/api/constants';
  const FIRESTORE_PAGE_SIZE_ESTIMATE = 100; // How many mods per Firestore doc 'page_X'?

  // --- State ---
  const sortOptions = [
    { label: 'Most Recent', value: 'recent' }, { label: 'Popular', value: 'popular' },
    { label: 'Downloads', value: 'downloads' }, { label: 'Rating', value: 'rating' }
  ];
  let selectedSort = sortOptions[0].value;
  let mods: Mod[] = [];
  let visibleCount = DISPLAY_PAGE_SIZE;
  let loading = false;
  let hasMoreToLoadFromSource = true;
  let isFullyLoaded = false; // Crucial flag

  let scrollContainer: HTMLElement;
  let sentinel: HTMLElement;
  let observer: IntersectionObserver;

  // Drag-to-scroll state
  let isDragging = false;
  let startX = 0;
  let scrollLeft = 0;

  // --- Core Logic ---

  function filterConsoleMods(mod: Mod): boolean {
    const text = `${mod.name?.toLowerCase() ?? ''} ${mod.summary?.toLowerCase() ?? ''}`;
    return !/(ps4|playstation|xbox)/i.test(text);
  }

  async function _fetchAndProcessPage(page: number): Promise<Mod[]> {
    const docRef = doc(db, 'mods', `page_${page}`);
    try {
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.mods && Array.isArray(data.mods)) {
          if (data.mods.length < FIRESTORE_PAGE_SIZE_ESTIMATE * 0.8) {
             hasMoreToLoadFromSource = false;
          }
          return data.mods.filter(filterConsoleMods);
        }
      }
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error);
    }
    hasMoreToLoadFromSource = false;
    return [];
  }

  function applySort() {
    if (!mods || mods.length === 0) return;
    switch (selectedSort) {
      case 'recent': mods.sort((a, b) => (b.date_added ?? 0) - (a.date_added ?? 0)); break;
      case 'popular': mods.sort((a, b) => (a.stats?.popularity_rank_position ?? Infinity) - (b.stats?.popularity_rank_position ?? Infinity)); break;
      case 'downloads': mods.sort((a, b) => (b.stats?.downloads_total ?? 0) - (a.stats?.downloads_total ?? 0)); break;
      case 'rating': mods.sort((a, b) => (b.stats?.ratings_weighted_aggregate ?? 0) - (a.stats?.ratings_weighted_aggregate ?? 0)); break;
    }
    mods = mods; // Force reactivity
  }

  async function loadMore() {
    if (loading) return;

    if (isFullyLoaded) { // Have everything, just reveal more
      if (visibleCount < mods.length) {
        visibleCount += DISPLAY_PAGE_SIZE;
      }
      return;
    }

    if (hasMoreToLoadFromSource) { // Need to fetch next page
      loading = true;
      const nextPage = Math.ceil(mods.length / FIRESTORE_PAGE_SIZE_ESTIMATE) + 1;
      const newMods = await _fetchAndProcessPage(nextPage);
      if (newMods.length > 0) {
          const currentIds = new Set(mods.map(m => m.id));
          const uniqueNewMods = newMods.filter(nm => !currentIds.has(nm.id));
          if (uniqueNewMods.length > 0) {
              mods = [...mods, ...uniqueNewMods];
          }
      }
      // Always increase visible count after attempting load, even if 0 new items added
      // Ensures pagination progresses if hasMoreToLoadFromSource becomes false mid-load
      visibleCount += DISPLAY_PAGE_SIZE;
      loading = false;
    } else { // No more source pages, just reveal remaining if any
        if (visibleCount < mods.length) {
           visibleCount += DISPLAY_PAGE_SIZE;
        }
    }
  }

  async function selectSort(sort: string) {
    if (selectedSort === sort || loading) return;
    loading = true;
    selectedSort = sort;
    if (observer && sentinel) observer.unobserve(sentinel);

    let allMods: Mod[] = [];
    let page = 1;
    hasMoreToLoadFromSource = true; // Reset checker
    while (hasMoreToLoadFromSource) {
        const pageMods = await _fetchAndProcessPage(page);
        if (pageMods.length > 0) {
            allMods = [...allMods, ...pageMods];
        }
        if (!hasMoreToLoadFromSource) break;
        page++;
        if (page > 50) { console.warn("Breaking loadAll loop"); break; }
    }

    mods = allMods;
    isFullyLoaded = true; // Mark as fully loaded
    hasMoreToLoadFromSource = false; // Explicitly set false
    applySort();
    visibleCount = DISPLAY_PAGE_SIZE;

    await tick();
    requestAnimationFrame(() => scrollContainer?.scrollTo({ left: 0, behavior: 'auto' }));
    loading = false;
    if (observer && sentinel && scrollContainer?.contains(sentinel)) observer.observe(sentinel);
  }

  // --- Lifecycle & Setup ---
  onMount(async () => {
    loading = true;
    mods = await _fetchAndProcessPage(1);
    isFullyLoaded = !hasMoreToLoadFromSource;
    applySort();
    loading = false;
    await tick();

    if (!scrollContainer) return;

    observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting && !loading) loadMore(); },
      { root: scrollContainer, threshold: 0.1, rootMargin: '0px 0px 200px 0px' }
    );

    if (sentinel) observer.observe(sentinel);
    scrollContainer.addEventListener('pointercancel', handlePointerUp);
  });

  onDestroy(() => {
    observer?.disconnect();
    scrollContainer?.removeEventListener('pointercancel', handlePointerUp);
  });

  // --- Drag Handlers ---
  function handlePointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('a.btn')) return;
    e.preventDefault(); isDragging = true;
    const target = e.currentTarget as HTMLElement;
    target.style.cursor = 'grabbing'; target.setPointerCapture(e.pointerId);
    startX = e.clientX - target.offsetLeft; scrollLeft = target.scrollLeft;
  }
  function handlePointerMove(e: PointerEvent) {
    if (!isDragging) return; e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    const x = e.clientX - target.offsetLeft;
    target.scrollLeft = scrollLeft - (x - startX) * 1.5;
  }
  function handlePointerUp(e: PointerEvent) {
    if (!isDragging) return; isDragging = false;
    const target = e.currentTarget as HTMLElement;
    target.style.cursor = 'grab'; target.releasePointerCapture(e.pointerId);
  }

</script>

<!-- Template -->
<div class="mx-auto p-4 max-w-full flex flex-col">
  <div class="mb-4 flex items-center gap-2 flex-wrap">
    {#each sortOptions as option}
      <button
        type="button"
        class="badge cursor-pointer transition-colors {selectedSort === option.value ? 'badge-primary' : 'badge-outline hover:bg-base-content hover:text-base-100 hover:border-base-content'}"
        on:click={() => selectSort(option.value)}
        disabled={loading}>
        {option.label}
      </button>
    {/each}
  </div>

  <div class="relative flex-grow overflow-hidden">
    {#if mods.length > 0}
      <div
        bind:this={scrollContainer}
        class="flex flex-row gap-4 overflow-x-auto pb-2 select-none touch-none scrollbar-thin h-full"
        class:cursor-grabbing={isDragging} class:cursor-grab={!isDragging}
        role="list"
        on:pointerdown={handlePointerDown} on:pointermove={handlePointerMove} on:pointerup={handlePointerUp}>

        {#each mods.slice(0, visibleCount) as mod (mod.id)}
          <div role="listitem" class="relative rounded-lg card shadow-md overflow-hidden flex-shrink-0 group aspect-video bg-base-200 w-96">
            {#if mod.logo?.thumb_320x180}
              <img src={mod.logo.thumb_320x180} alt="{mod.name} thumbnail" class="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-110" loading="lazy" draggable="false" />
            {:else}
              <div class="absolute inset-0 grid place-content-center bg-base-300 text-base-content/50 text-sm">No Image</div>
            {/if}
            <div class="absolute bottom-0 z-10 w-full p-3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
              <span class="font-semibold text-lg text-white drop-shadow-md line-clamp-2">{mod.name ?? 'Untitled Mod'}</span>
            </div>
            <div class="absolute inset-0 z-20 flex items-center justify-center gap-3 bg-neutral/70 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none">
              <a href={mod.profile_url} target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm pointer-events-auto" title="View on Mod.io" on:click|stopPropagation>View Details</a>
              {#if mod.modfile?.download?.binary_url}
                <a href={mod.modfile.download.binary_url} download class="btn btn-primary btn-sm pointer-events-auto" title="Download Mod" on:click|stopPropagation>Download</a>
              {:else}
                <span class="badge badge-sm badge-error pointer-events-auto opacity-80">No file</span>
              {/if}
            </div>
          </div>
        {/each}

        <div bind:this={sentinel} class="flex-shrink-0 grid place-content-center p-4 min-w-[50px] h-full">
          {#if loading}
            <span class="loading loading-spinner loading-lg"></span>
          {:else if (isFullyLoaded || !hasMoreToLoadFromSource) && visibleCount >= mods.length}
             <span class="text-xs text-base-content/50 whitespace-nowrap">End of list</span>
          {/if}
        </div>
      </div>
    {:else if loading}
      <div class="grid place-content-center h-64"><span class="loading loading-spinner loading-lg"></span></div>
    {:else}
      <p class="text-center py-10 text-base-content/80">No map mods found.</p>
    {/if}
  </div>
</div>

<style>
  .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .scrollbar-thin::-webkit-scrollbar { height: 6px; width: 6px; }
  .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
  .scrollbar-thin::-webkit-scrollbar-thumb { background-color: rgba(128, 128, 128, 0.4); border-radius: 3px;}
  .scrollbar-thin::-webkit-scrollbar-thumb:hover { background-color: rgba(128, 128, 128, 0.6); }
  .scrollbar-thin { scrollbar-width: thin; scrollbar-color: rgba(128, 128, 128, 0.4) transparent;}
</style>
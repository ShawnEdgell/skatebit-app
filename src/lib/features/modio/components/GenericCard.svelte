<script lang="ts">
  export let imageUrl: string = '';
  export let fallbackIcon: string = '📄';
  export let badgeText: string = '';
  export let title: string = '';
</script>

<div
  role="listitem"
  class="relative rounded-lg card shadow-md overflow-hidden flex-shrink-0 group aspect-video bg-base-200 w-80"
>
  {#if imageUrl}
    <img
      src={imageUrl}
      alt="{title} thumbnail"
      class="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
      loading="lazy"
      draggable="false"
    />
  {:else}
    <div class="absolute inset-0 grid place-content-center bg-base-300 text-base-content/50 text-5xl">
      {fallbackIcon}
    </div>
  {/if}

  {#if badgeText}
    <span class="absolute top-1 right-1 bg-black/50 text-white text-xs rounded px-2 py-1">
      {badgeText}
    </span>
  {/if}

  <div class="absolute bottom-0 z-10 w-full p-3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
    <span class="font-semibold text-lg text-white drop-shadow-md line-clamp-2">{title}</span>
  </div>

  <div class="absolute inset-0 z-20 flex items-center justify-center gap-3 bg-neutral/70 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none">
    <slot name="overlay" />
  </div>
</div>

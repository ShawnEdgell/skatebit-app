<script lang="ts">
  export let imageUrl: string = ''
  export let imageAlt: string = 'Card image'
  export let fallbackContent: string = '📄' // Default is file, but consumers override
  export let fallbackClass: string = 'text-5xl'
  export let badgeText: string = ''
  export let title: string = ''
  export let cardTitleAttr: string = ''
</script>

<div
  role="listitem"
  class="card group bg-base-200 relative aspect-video w-80 flex-shrink-0 overflow-hidden shadow-md"
  title={cardTitleAttr || title}
>
  {#if imageUrl}
    <img
      src={imageUrl}
      alt={imageAlt}
      class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
      loading="lazy"
      draggable="false"
    />
  {:else}
    <div
      class="bg-base-300 text-base-content/50 absolute inset-0 grid place-content-center {fallbackClass}"
    >
      {@html fallbackContent}
    </div>
  {/if}

  {#if badgeText}
    <span
      class="absolute top-1 right-1 rounded bg-black/50 px-2 py-1 text-xs text-white"
    >
      {badgeText}
    </span>
  {/if}

  <div
    class="pointer-events-none absolute bottom-0 z-10 w-full bg-gradient-to-t from-black/80 to-transparent p-3"
  >
    <span
      class="line-clamp-2 text-lg leading-tight font-semibold text-white shadow-md"
    >
      {title}
    </span>
    <slot name="info" />
  </div>

  <div
    class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center gap-3 bg-black/70 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
  >
    <slot name="actions" />
  </div>
</div>

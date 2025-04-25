<script lang="ts">
  import { onMount } from 'svelte'
  import { themeChange } from 'theme-change'
  import { ChevronDown } from 'lucide-svelte' // Import Lucide icon

  type Theme = {
    label: string
    value: string
  }

  const themes: Theme[] = [
    { label: 'Dark', value: 'dark' },
    { label: 'Cupcake', value: 'cupcake' },
    { label: 'Retro', value: 'retro' },
    { label: 'Valentine', value: 'valentine' },
    { label: 'Aqua', value: 'aqua' },
    { label: 'Dracula', value: 'dracula' },
    { label: 'Business', value: 'business' },
    { label: 'Acid', value: 'acid' },
    { label: 'Night', value: 'night' },
    { label: 'Sunset', value: 'sunset' },
    { label: 'Dim', value: 'dim' },
    { label: 'Cyberpunk', value: 'cyberpunk' },
    { label: 'silk', value: 'silk' },
    { label: 'nord', value: 'nord' },
  ]

  let selectedTheme: string = themes[0].value

  onMount(() => {
    themeChange(false)

    const currentTheme = document.documentElement.getAttribute('data-theme')
    if (currentTheme) {
      selectedTheme = currentTheme
    }
  })

  function handleChange() {
    localStorage.setItem('theme', selectedTheme)
    console.log('Theme saved:', selectedTheme)
  }
</script>

<div title="Theme" class="dropdown dropdown-end">
  <div tabindex="0" role="button" class="flex items-center gap-1.5">
    <span>Theme</span>
    <ChevronDown class="inline-block h-3.5 w-3.5 opacity-80" />
  </div>
  <ul
    tabindex="0"
    class="dropdown-content bg-base-200 rounded-box top-12 mt-6 w-52 p-2 shadow-md"
  >
    {#each themes as { label, value }}
      <li>
        <input
          type="radio"
          name="theme-dropdown"
          class="theme-controller btn btn-ghost z-100 w-full justify-start"
          aria-label={label}
          data-set-theme={value}
          {value}
          bind:group={selectedTheme}
          on:change={handleChange}
          class:btn-active={selectedTheme === value}
        />
      </li>
    {/each}
  </ul>
</div>

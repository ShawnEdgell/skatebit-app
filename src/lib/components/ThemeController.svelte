<script lang="ts">
  import { onMount } from 'svelte'
  import { themeChange } from 'theme-change'

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
  <div tabindex="0" role="button" class="flex items-center gap-2">
    <span>Theme</span>
    <svg
      width="12px"
      height="12px"
      class="inline-block h-2 w-2 fill-current opacity-60"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 2048 2048"
    >
      <path d="M1799 349l242 241-1017 1017L7 590l242-241 775 775 775-775z"
      ></path>
    </svg>
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

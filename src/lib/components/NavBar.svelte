<script lang="ts">
  import { Window } from '@tauri-apps/api/window'
  import ThemeController from './ThemeController.svelte'
  import FolderSelector from './FolderSelector.svelte'
  import { page } from '$app/stores'
  import { Minus, Maximize2, X } from 'lucide-svelte'

  const appWindow = Window.getCurrent()

  type NavLink = {
    href: string
    title: string
    text: string
    dev?: boolean
  }

  const navLinks: NavLink[] = [
    { href: '/', title: 'Folders', text: 'Folders' },
    { href: '/modio', title: 'Maps', text: 'Maps' },
    { href: '/stats', title: 'Stats', text: 'Stats (dev)', dev: true },
  ]

  // Filter out dev-only links in production
  $: visibleNavLinks = navLinks.filter(
    (link) => !link.dev || import.meta.env.DEV,
  )

  const windowControls = [
    { tip: 'Minimize', action: 'minimize', icon: Minus },
    { tip: 'Maximize', action: 'toggleMaximize', icon: Maximize2 },
    { tip: 'Close', action: 'close', icon: X },
  ] as const

  async function handleWindowAction(
    action: 'minimize' | 'toggleMaximize' | 'close',
  ) {
    await appWindow[action]()
  }

  const getLinkClass = (href: string) => {
    const isActive =
      href === '/'
        ? $page.url.pathname === href
        : $page.url.pathname.startsWith(href)
    return `transition-colors ${
      isActive ? 'text-base-content' : 'text-base-content/50'
    }`
  }
</script>

<div
  class="navbar bg-base-300 px-4"
  style="-webkit-app-region: drag;"
  role="banner"
  on:dblclick={() => handleWindowAction('toggleMaximize')}
>
  <div class="flex w-full justify-between">
    <div class="flex items-center">
      <ul class="menu menu-horizontal" style="-webkit-app-region: no-drag;">
        {#each visibleNavLinks as link (link.href)}
          <li>
            <a
              href={link.href}
              class={getLinkClass(link.href)}
              title={link.title}
            >
              {link.text}
            </a>
          </li>
        {/each}
      </ul>
    </div>

    <div class="flex items-center" style="-webkit-app-region: no-drag;">
      <ul class="menu menu-horizontal mr-2">
        <li><FolderSelector /></li>
        <li><ThemeController /></li>
      </ul>
      <div class="flex space-x-2">
        {#each windowControls as control (control.action)}
          <button
            data-tip={control.tip}
            class="tooltip tooltip-bottom btn btn-xs btn-circle btn-soft h-6 w-6"
            on:click={() => handleWindowAction(control.action)}
            title={control.tip}
          >
            <svelte:component this={control.icon} class="h-4 w-4" />
          </button>
        {/each}
      </div>
    </div>
  </div>
</div>

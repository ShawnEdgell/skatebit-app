<script lang="ts">
  import { Window } from '@tauri-apps/api/window'
  import ThemeController from './ThemeController.svelte'
  import FolderSelector from './FolderSelector.svelte'
  import { page } from '$app/stores'
  import { dev } from '$app/environment'
  import { Minus, Square, X } from 'lucide-svelte'

  const appWindow = Window.getCurrent()

  async function closeWindow() {
    await appWindow.close()
  }

  async function minimizeWindow() {
    await appWindow.minimize()
  }

  async function toggleMaximize() {
    await appWindow.toggleMaximize()
  }
</script>

<div
  class="navbar bg-base-300 px-4"
  style="-webkit-app-region: drag;"
  role="banner"
  on:dblclick={toggleMaximize}
>
  <div class="flex w-full justify-between">
    <div class="flex items-center">
      <ul class="menu menu-horizontal" style="-webkit-app-region: no-drag;">
        <li>
          <a
            href="/"
            class={`transition-colors ${$page.url.pathname === '/' ? 'text-base-content' : 'text-base-content/50'}`}
            title="Folders"
          >
            Folders
          </a>
        </li>
        <li>
          <a
            href="/modio"
            class={`transition-colors ${$page.url.pathname.startsWith('/modio') ? 'text-base-content' : 'text-base-content/50'}`}
            title="Maps"
          >
            Maps
          </a>
        </li>
        {#if dev}
          <li>
            <a
              href="/cache"
              class={`transition-colors ${$page.url.pathname.startsWith('/cache') ? 'text-base-content' : 'text-base-content/50'}`}
              title="Cache"
            >
              Cache
            </a>
          </li>
        {/if}
      </ul>
    </div>

    <div class="flex items-center" style="-webkit-app-region: no-drag;">
      <ul class="menu menu-horizontal mr-2">
        <li><FolderSelector /></li>
        <li><ThemeController /></li>
      </ul>
      <div class="flex flex-none space-x-2">
        <button
          data-tip="Minimize"
          class="tooltip tooltip-bottom btn btn-xs btn-circle btn-soft z-50 h-6 w-6"
          on:click={minimizeWindow}
        >
          <Minus class="h-4 w-4" stroke-width={1.5} />
        </button>

        <button
          data-tip="Maximize"
          class="tooltip tooltip-bottom btn btn-xs btn-circle btn-soft z-50 h-6 w-6"
          on:click={toggleMaximize}
        >
          <Square class="h-4 w-4" stroke-width={1.5} />
        </button>

        <button
          data-tip="Close"
          class="tooltip tooltip-bottom btn btn-xs btn-circle btn-soft z-50 h-6 w-6"
          on:click={closeWindow}
        >
          <X class="h-4 w-4" stroke-width={1.5} />
        </button>
      </div>
    </div>
  </div>
</div>

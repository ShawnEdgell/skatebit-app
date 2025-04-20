<script lang="ts">
  import { Window } from '@tauri-apps/api/window'
  import ThemeController from './ThemeController.svelte'
  import FolderSelector from './FolderSelector.svelte'
  import { page } from '$app/stores'

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

<!-- The entire navbar is draggable by default -->
<div
  class="navbar bg-base-300 px-4"
  style="-webkit-app-region: drag;"
  role="banner"
  on:dblclick={toggleMaximize}
>
  <div class="flex w-full justify-between">
    <!-- Left area: Draggable logo and navigation links -->
    <div class="flex items-center">
      <!-- The XLFM logo is draggable and has a default cursor -->
      <h1
        class="mr-2 text-2xl font-black tracking-tight"
        style="cursor: default;"
      >
        XLFM
      </h1>
      <!-- Navigation links remain clickable -->
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
        <!-- <li>
          <a
            href="/stats"
            class={`transition-colors ${$page.url.pathname.startsWith('/stats') ? 'text-base-content' : 'text-base-content/50'}`}
            title="Stats"
          >
            Stats
          </a>
        </li> -->
      </ul>
    </div>

    <!-- Right area: Interactive elements (non-draggable) -->
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
          <!-- Minimize Icon -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            class="h-4 w-4"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M20 12H4"
            />
          </svg>
        </button>

        <button
          data-tip="Maximize"
          class="tooltip tooltip-bottom btn btn-xs btn-circle btn-soft z-50 h-6 w-6"
          on:click={toggleMaximize}
        >
          <!-- Maximize Icon: a simple square outline -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            class="h-4 w-4"
          >
            <rect
              x="4"
              y="4"
              width="16"
              height="16"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <button
          data-tip="Close"
          class="tooltip tooltip-bottom btn btn-xs btn-circle btn-soft z-50 h-6 w-6"
          on:click={closeWindow}
        >
          <!-- Close Icon -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            class="h-4 w-4"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
</div>

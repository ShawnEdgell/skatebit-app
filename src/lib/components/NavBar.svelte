<script lang="ts">
  import { Window } from '@tauri-apps/api/window';
  import ThemeController from './ThemeController.svelte';
  import FolderSelector from './FolderSelector.svelte';
  import { page } from '$app/stores';

  const appWindow = Window.getCurrent();

  async function closeWindow() {
    await appWindow.close();
  }

  async function toggleMaximize() {
    await appWindow.toggleMaximize();
  }
</script>

<div
  class="navbar bg-base-300"
  style="-webkit-app-region: drag;"
  role="banner"
  on:dblclick={toggleMaximize}
>
  <div class="flex justify-between w-full">
    <ul class="menu menu-horizontal" style="-webkit-app-region: no-drag;">
      <li>
        <a
          href="/"
          class={`transition-colors ${
            $page.url.pathname === '/' ? 'text-base-content' : 'text-base-content/50'
          }`}
        >
          Folders
        </a>
      </li>
      <li>
        <a
          href="/modio"
          class={`transition-colors ${
            $page.url.pathname.startsWith('/modio') ? 'text-base-content' : 'text-base-content/50'
          }`}
        >
          Maps
        </a>
      </li>
    </ul>

    <ul class="menu menu-horizontal mr-2" style="-webkit-app-region: no-drag;">
      <li>
        <FolderSelector />
      </li>
      <li>
        <ThemeController />
      </li>
    </ul>
  </div>

  <div class="flex-none" style="-webkit-app-region: no-drag;">
    <button
      class="btn btn-sm btn-circle btn-soft mr-2"
      on:click={closeWindow}
      aria-label="Close Window"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        class="inline-block w-6 h-6 stroke-current"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  </div>
</div>

<script lang="ts">
  import { Window } from '@tauri-apps/api/window';
  import ThemeController from './ThemeController.svelte';

  // Get the current window instance
  const appWindow = Window.getCurrent();

  async function closeWindow() {
    await appWindow.close();
  }

  async function toggleMaximize() {
    await appWindow.toggleMaximize();
  }
</script>

<!-- 
  The outer div is marked as draggable with "-webkit-app-region: drag" and given a role ("banner")
  for accessibility. We attach a dblclick handler to toggle maximization.
-->
<div 
  class="navbar bg-base-300"
  style="-webkit-app-region: drag;"
  role="banner"
  on:dblclick={toggleMaximize}
>
  <div class="flex justify-between w-full">
    <ul class="menu menu-horizontal">
      <li><a href="/">File Explorer</a></li>
      <li><a href="/modio">Maps</a></li>
    </ul>
    <ul class="menu menu-horizontal">
      <li>
        <ThemeController />
      </li>
    </ul>
  </div>

  <!-- 
       The control button container is non-draggable via "-webkit-app-region: no-drag".
       The close button includes an aria-label for accessibility.
  -->
  <div class="flex-none" style="-webkit-app-region: no-drag;">
    <button class="btn btn-sm btn-circle btn-soft mr-2" on:click={closeWindow} aria-label="Close Window">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" 
           class="inline-block w-6 h-6 stroke-current">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</div>

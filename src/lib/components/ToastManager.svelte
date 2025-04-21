<script lang="ts">
  import { onDestroy } from 'svelte'
  import { downloadProgress } from '$lib/stores/downloadProgressStore'
  import { toastStore } from '$lib/stores/uiStore'
  import type { InstallationProgress } from '$lib/types/downloadTypes'

  const toastMap = new Map<string, number>()

  const unsubscribe = downloadProgress.subscribe((progressMap) => {
    for (const [source, data] of Object.entries(progressMap)) {
      const { step, progress, message, label } = data as InstallationProgress
      const name = label ?? 'Unknown File'

      const percent = Math.round(progress * 100)
        .toString()
        .padStart(3, ' ')

      const status =
        step === 'downloading'
          ? `⬇️ <strong>Downloading:</strong> ${name}… ${percent}%`
          : step === 'extracting'
            ? `📦 <strong>Unzipping:</strong> ${name}…`
            : step === 'saving'
              ? `💾 <strong>Saving:</strong> ${name}…`
              : step === 'complete'
                ? `✅ <strong>Installed:</strong> ${name}`
                : step === 'error'
                  ? `❌ <strong>Failed:</strong> ${name}`
                  : `${message || 'Installing'}: ${name}`

      const variant =
        step === 'error'
          ? 'alert-error'
          : step === 'complete'
            ? 'alert-success'
            : 'alert-info'

      const id = toastMap.get(source)
      if (id != null) {
        toastStore.updateToast(id, status, variant)
      } else {
        const newId = toastStore.addToast(status, variant, 0)
        toastMap.set(source, newId)
      }

      if (step === 'complete' || step === 'error') {
        setTimeout(() => {
          downloadProgress.update((prev) => {
            const next = { ...prev }
            delete next[source]
            return next
          })
          const tid = toastMap.get(source)
          if (tid != null) toastStore.removeToast(tid)
          toastMap.delete(source)
        }, 5000)
      }
    }
  })

  onDestroy(() => {
    unsubscribe()
    toastMap.clear()
  })
</script>

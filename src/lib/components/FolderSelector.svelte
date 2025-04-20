<script lang="ts">
  import { open as openDialog } from '@tauri-apps/plugin-dialog'
  import { invoke } from '@tauri-apps/api/core'
  import { mapsDirectory } from '$lib/stores/globalPathsStore'
  import { openModal } from '$lib/stores/uiStore'
  import { toastStore } from '$lib/stores/uiStore'
  import { documentDir, join } from '@tauri-apps/api/path'
  import { tick } from 'svelte'
  import { normalizePath } from '$lib/services/pathService'
  import { handleError, handleSuccess } from '$lib/utils/errorHandler'
  import { updateMapsSymlink } from '$lib/services/symlinkService'
  import { get } from 'svelte/store'
  import { isMapsSymlinked } from '$lib/stores/globalPathsStore'

  async function resetToDefault() {
    try {
      const docDirResult = await documentDir()
      if (!docDirResult) {
        handleError(
          new Error('Could not determine Documents directory.'),
          'Resetting to default',
        )
        return
      }
      const docDir = normalizePath(docDirResult)
      const defaultFolder = await join(docDir, 'SkaterXL', 'Maps')
      const normalizedDefault = normalizePath(defaultFolder ?? '')

      try {
        await invoke('remove_maps_symlink', { linkPathStr: normalizedDefault })
      } catch (symlinkErr) {
        handleError(symlinkErr, 'Removing Symlink')
        toastStore.addToast(
          'Could not automatically remove old symlink. Check permissions or remove manually.',
          'alert-warning',
          7000,
        )
      }

      try {
        await invoke('create_directory_rust', {
          absolutePath: normalizedDefault,
        })
      } catch (createDirErr) {
        handleError(createDirErr, 'Creating Default Directory')
        toastStore.addToast(
          'Could not create the default Maps folder. Check permissions.',
          'alert-error',
          7000,
        )
      }

      mapsDirectory.set(normalizedDefault)
      handleSuccess('Maps folder reset to default', 'Installation')
      await tick()
    } catch (err) {
      handleError(err, 'Resetting to default')
    }
  }

  async function selectFolder() {
    const currentFolder = get(mapsDirectory)
    const normalizedCurrent = normalizePath(currentFolder || '')

    const docDirResult = await documentDir()
    if (!docDirResult) {
      console.error('Could not determine Documents directory.')
      return
    }
    const currentDocDir = normalizePath(docDirResult)
    let defaultFolder: string | null = null
    let normalizedDefault: string | null = null
    try {
      defaultFolder = await join(currentDocDir, 'SkaterXL', 'Maps')
      normalizedDefault = defaultFolder ? normalizePath(defaultFolder) : null
    } catch (err) {
      handleError(err, 'Calculating Default Folder Path')
    }

    const modalConfig: any = {
      title: 'Change Maps Folder?',
      message: `This feature changes your Skater XL maps location using a system shortcut (Symbolic Link) at Documents/SkaterXL/Maps.<br><br><strong class="text-warning">Administrator Privileges Needed:</strong> Please restart this application as Administrator, otherwise the link won't be created and the game won't find your maps. You can skip this step if you've already set up your Symlink manually. <br><br>Your active map folder will be safely renamed as a backup and added to your Documents (e.g., Maps_backup).<br><br>Type "<strong>free dawg</strong>" to continue.`,
      confirmText: 'Select Folder',
      cancelText: 'Cancel',
      confirmOnly: false,
      placeholder: 'free dawg',
      confirmClass: 'btn-primary',
      onSave: async (inputValue?: string) => {
        const docDirOnSaveResult = await documentDir()
        const docDirOnSave = docDirOnSaveResult
          ? normalizePath(docDirOnSaveResult)
          : null
        try {
          const currentFolderInner = get(mapsDirectory)
          const normCurrentInner = normalizePath(currentFolderInner || '')

          const selected = await openDialog({
            directory: true,
            multiple: false,
            title: 'Select Your SkaterXL Maps Folder',
            defaultPath: currentFolderInner || undefined,
          })

          if (typeof selected === 'string' && selected.trim() !== '') {
            const normalizedSelected = normalizePath(selected)
            let currentNormalizedDefault: string | null = null
            if (docDirOnSave) {
              try {
                const defaultFolderInner = await join(
                  docDirOnSave,
                  'SkaterXL',
                  'Maps',
                )
                currentNormalizedDefault = defaultFolderInner
                  ? normalizePath(defaultFolderInner)
                  : null
              } catch (err) {
                console.error('Error recalculating default path:', err)
              }
            }

            if (normalizedSelected && normalizedSelected !== normCurrentInner) {
              mapsDirectory.set(normalizedSelected)
              handleSuccess('Maps folder updated', 'Installation')

              if (
                currentNormalizedDefault &&
                normalizedSelected !== currentNormalizedDefault
              ) {
                await updateMapsSymlink(normalizedSelected)
              } else if (
                currentNormalizedDefault &&
                normalizedSelected === currentNormalizedDefault
              ) {
                try {
                  await invoke('remove_maps_symlink', {
                    linkPathStr: currentNormalizedDefault,
                  })
                } catch (symlinkErr) {
                  handleError(
                    symlinkErr,
                    'Removing Symlink (on Default Select)',
                  )
                }
              }
              await tick()

              if (
                docDirOnSave &&
                !normalizedSelected.startsWith(docDirOnSave)
              ) {
              }
            } else if (
              normalizedSelected &&
              normalizedSelected === normCurrentInner
            ) {
              toastStore.addToast('Maps folder unchanged.', 'alert-info')
            }
          } else if (selected === null) {
            console.log('User cancelled folder selection dialog.')
          } else {
            console.warn(
              'Folder selection dialog returned unexpected value:',
              selected,
            )
          }
        } catch (err) {
          handleError(err, 'Processing Selected Folder')
        }
      },
    }

    if ($isMapsSymlinked) {
      modalConfig.secondaryText = 'Reset to Default'
      modalConfig.onSecondary = async () => {
        await resetToDefault()
      }
    }

    openModal(modalConfig)
  }
</script>

<button title="Change Maps Folder" on:click={selectFolder}
  >Change Maps Folder</button
>

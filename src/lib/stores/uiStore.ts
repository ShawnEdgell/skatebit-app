import { writable } from 'svelte/store'
import type { ModalProps, Toast, ToastVariant } from '$lib/types/uiTypes'

const defaultModal: ModalProps = {
  open: false,
  title: '',
  message: '',
  placeholder: '',
  initialValue: '',
  inputValue: '',
  confirmOnly: false,
  confirmText: '',
  confirmClass: '',
  cancelText: '',
}

export const modalStore = writable<ModalProps>(defaultModal)

export function openModal(props: Partial<ModalProps>) {
  modalStore.set({ ...defaultModal, ...props, open: true })
}

export function closeModal() {
  modalStore.update((modal) => ({ ...modal, open: false }))
}

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([])
  let toastId = 0

  return {
    subscribe,
    addToast(message: string, variant: ToastVariant, duration = 3000): number {
      // Return the ID
      const id = ++toastId
      const newToast: Toast = { id, message, variant, duration }
      update((toasts) => [...toasts, newToast])

      // Only set timeout if duration is greater than 0
      if (duration > 0) {
        setTimeout(() => {
          // Use the id captured in this scope
          update((toasts) => toasts.filter((t) => t.id !== id))
        }, duration)
      }
      // Return the ID so it can be used for manual removal
      return id
    },
    removeToast(id: number | null) {
      // Allow null check
      if (id === null) return // Do nothing if ID is null
      update((toasts) => toasts.filter((t) => t.id !== id))
    },
  }
}

export const toastStore = createToastStore()

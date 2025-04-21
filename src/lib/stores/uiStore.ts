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
      const id = ++toastId
      const newToast: Toast = { id, message, variant, duration }
      update((toasts) => [...toasts, newToast])

      if (duration > 0) {
        setTimeout(() => {
          update((toasts) => toasts.filter((t) => t.id !== id))
        }, duration)
      }

      return id
    },

    removeToast(id: number | null) {
      if (id === null) return
      update((toasts) => toasts.filter((t) => t.id !== id))
    },

    updateToast(id: number, newMessage: string, newVariant?: ToastVariant) {
      update((toasts) =>
        toasts.map((toast) =>
          toast.id === id
            ? {
                ...toast,
                message: newMessage,
                ...(newVariant ? { variant: newVariant } : {}),
              }
            : toast,
        ),
      )
    },
  }
}

export const toastStore = createToastStore()

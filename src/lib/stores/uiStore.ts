// src/lib/stores/uiStore.ts
import { writable } from "svelte/store";
import type { ModalProps, Toast } from "$lib/types/uiTypes";

const defaultModal: ModalProps = {
  open: false,
  title: "",
  message: "",
  placeholder: "",
  initialValue: "",
  inputValue: "",
  confirmOnly: false,
  confirmText: "",
  confirmClass: "",
  cancelText: "",
};

export const modalStore = writable<ModalProps>(defaultModal);

// Update openModal to accept Partial<ModalProps> so the caller doesn’t have to include all properties.
export function openModal(props: Partial<ModalProps>) {
  modalStore.set({ ...defaultModal, ...props, open: true });
}

export function closeModal() {
  modalStore.update((modal) => ({ ...modal, open: false }));
}

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);
  let toastId = 0;
  return {
    subscribe,
    addToast(message: string, variant: Toast["variant"], duration = 3000) {
      const id = ++toastId;
      update((toasts) => [...toasts, { id, message, variant, duration }]);
      setTimeout(() => {
        update((toasts) => toasts.filter((t) => t.id !== id));
      }, duration);
    },
    removeToast(id: number) {
      update((toasts) => toasts.filter((t) => t.id !== id));
    },
  };
}

export const toastStore = createToastStore();

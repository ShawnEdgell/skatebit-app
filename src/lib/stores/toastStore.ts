import { writable } from "svelte/store";

export type ToastVariant =
  | "alert-success"
  | "alert-info"
  | "alert-warning"
  | "alert-error";

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
  duration?: number; // in milliseconds
}

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);
  let toastId = 0;

  function addToast(message: string, variant: ToastVariant, duration = 3000) {
    const id = ++toastId;
    update((toasts) => [...toasts, { id, message, variant, duration }]);
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }

  function removeToast(id: number) {
    update((toasts) => toasts.filter((t) => t.id !== id));
  }

  return {
    subscribe,
    addToast,
    removeToast,
  };
}

export const toastStore = createToastStore();

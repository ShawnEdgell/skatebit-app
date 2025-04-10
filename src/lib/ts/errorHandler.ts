import { toastStore } from "$lib/stores/toastStore";
import type { ToastVariant } from "$lib/stores/toastStore";

// Utility function for showing toasts
function showToast(message: string, variant: ToastVariant, duration: number) {
  toastStore.addToast(message, variant, duration);
}

export function handleError(error: unknown, context: string = ""): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`Error ${context ? `in ${context}: ` : ""}`, error);
  showToast(
    `Error ${context ? `in ${context}: ` : ""}${errorMessage}`,
    "alert-error",
    5000
  );
}

export function handleSuccess(message: string, context: string = ""): void {
  showToast(
    `${context ? context + ": " : ""}${message}`,
    "alert-success",
    3000
  );
}

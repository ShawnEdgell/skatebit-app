// In src/lib/ts/errorHandler.ts
import { toastStore } from "$lib/stores/toastStore";

export function handleError(error: unknown, context: string = ""): void {
  console.error(`Error ${context ? `in ${context}` : ""}:`, error);
  // Use a valid ToastVariant, e.g. 'toast-error'
  toastStore.addToast(
    `Error ${context ? `in ${context}` : ""}`,
    "alert-error",
    5000
  );
}

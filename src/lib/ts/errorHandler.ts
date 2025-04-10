// src/lib/ts/errorHandler.ts
import { toastStore } from "$lib/stores/toastStore";

export function handleError(error: unknown, context: string = ""): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`Error ${context ? `in ${context}: ` : ""}`, error);
  toastStore.addToast(
    `Error ${context ? `in ${context}: ` : ""}${errorMessage}`,
    "alert-error",
    5000
  );
}

// Optionally, create a success function as well:
export function handleSuccess(message: string, context: string = ""): void {
  toastStore.addToast(
    `${context ? context + ": " : ""}${message}`,
    "alert-success",
    3000
  );
}

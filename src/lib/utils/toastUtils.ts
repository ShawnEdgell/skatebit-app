// src/lib/ts/toastUtils.ts
import { toastStore } from "$lib/stores/toastStore";
import type { ToastVariant } from "$lib/stores/toastStore";

export function showToast(
  message: string,
  variant: ToastVariant = "alert-info",
  duration = 3000
) {
  toastStore.addToast(message, variant, duration);
}

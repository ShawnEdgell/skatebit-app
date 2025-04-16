// src/lib/ts/toastUtils.ts
import { toastStore } from "$lib/stores/uiStore";
import type { ToastVariant } from "$lib/types/uiTypes";

export function showToast(
  message: string,
  variant: ToastVariant = "alert-info",
  duration = 3000
) {
  toastStore.addToast(message, variant, duration);
}

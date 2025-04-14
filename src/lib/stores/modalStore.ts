// src/lib/stores/modalStore.ts
import { writable } from "svelte/store";

export interface ModalProps {
  open: boolean;
  title: string; // required
  message: string; // required (can be an empty string)
  placeholder: string; // required
  initialValue: string; // required
  inputValue: string; // required
  confirmOnly: boolean;
  confirmText: string; // required
  confirmClass: string; // required
  cancelText: string; // required
  onSave?: (value: string) => Promise<void> | void;
  onCancel?: () => void;
  secondaryText?: string; // optional
  onSecondary?: () => Promise<void> | void; // optional
}

export const modalStore = writable<ModalProps>({
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
  onSave: undefined,
  onCancel: undefined,
  secondaryText: undefined,
  onSecondary: undefined,
});

export function openModal(config: Partial<ModalProps>) {
  modalStore.update(() => ({
    open: true,
    title: config.title ?? "",
    message: config.message ?? "",
    placeholder: config.placeholder ?? "",
    initialValue: config.initialValue ?? "",
    inputValue: config.initialValue ?? "",
    confirmOnly: config.confirmOnly ?? false,
    confirmText: config.confirmText ?? "",
    confirmClass: config.confirmClass ?? "",
    cancelText: config.cancelText ?? "",
    onSave: config.onSave,
    onCancel: config.onCancel,
    secondaryText: config.secondaryText,
    onSecondary: config.onSecondary,
  }));
}

export function closeModal() {
  modalStore.update(() => ({
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
    onSave: undefined,
    onCancel: undefined,
    secondaryText: undefined,
    onSecondary: undefined,
  }));
}

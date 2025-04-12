// src/lib/stores/modalStore.ts
import { writable } from "svelte/store";

export interface ModalProps {
  open: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  inputValue?: string;
  confirmOnly: boolean;
  confirmText?: string;
  confirmClass?: string;
  cancelText?: string;
  onSave?: (value: string) => Promise<void> | void;
  onCancel?: () => void;
}

export const modalStore = writable<ModalProps>({
  open: false,
  title: "",
  message: undefined,
  placeholder: "",
  initialValue: "",
  inputValue: "",
  confirmOnly: false,
  confirmText: undefined,
  confirmClass: undefined,
  cancelText: undefined,
  onSave: undefined,
  onCancel: undefined,
});

export function openModal(config: Partial<ModalProps>) {
  modalStore.update((state) => ({
    ...state,
    ...config,
    open: true,
    initialValue: config.initialValue ?? "",
    inputValue: config.initialValue ?? "",
  }));
}

export function closeModal() {
  modalStore.update((state) => ({
    ...state,
    open: false,
    title: "",
    message: undefined,
    placeholder: "",
    initialValue: "",
    inputValue: "",
    confirmOnly: false,
    confirmText: undefined,
    confirmClass: undefined,
    cancelText: undefined,
    onSave: undefined,
    onCancel: undefined,
  }));
}

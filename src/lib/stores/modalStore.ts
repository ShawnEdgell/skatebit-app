// src/lib/stores/modalStore.ts
import { writable } from "svelte/store";

export type ModalType = "crud" | null;

export interface CrudModalProps {
  action: "rename" | "newFolder" | "newFile" | "delete";
  currentPath: string;
  currentName: string;
  onConfirm?: () => Promise<void> | void;
}

export interface ModalState {
  open: boolean;
  type: ModalType;
  props: CrudModalProps;
}

// Initialize with default props.
export const modalStore = writable<ModalState>({
  open: false,
  type: null,
  props: {
    action: "rename", // default action
    currentPath: "",
    currentName: "",
  },
});

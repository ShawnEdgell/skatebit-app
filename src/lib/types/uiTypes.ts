export interface ModalProps {
  open: boolean
  title: string
  message?: string
  placeholder?: string
  initialValue?: string
  inputValue?: string
  confirmOnly?: boolean
  confirmText?: string
  confirmClass?: string
  cancelText?: string
  secondaryText?: string
  onSave?: (value: string) => Promise<void> | void
  onCancel?: () => void
  onSecondary?: () => Promise<void> | void
}

export type ToastVariant =
  | 'alert-success'
  | 'alert-info'
  | 'alert-warning'
  | 'alert-error'

export interface Toast {
  id: number
  message: string
  variant: ToastVariant
  duration?: number
}

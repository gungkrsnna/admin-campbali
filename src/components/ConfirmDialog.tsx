import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Icon } from './icons'
import { Button } from './ui'

type ConfirmOptions = {
  title: string
  message?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** "danger" for deleting or discarding, which can't be undone. */
  tone?: 'danger' | 'default'
}
type Confirm = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<Confirm | null>(null)

/** Provides `useConfirm()`: the admin's own confirmation dialog, used instead of the browser's confirm(). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [open, setOpen] = useState(false)
  const resolver = useRef<(answer: boolean) => void>(null)

  const confirm = useCallback<Confirm>((next) => {
    setOptions(next)
    setOpen(true)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  function answer(value: boolean) {
    resolver.current?.(value)
    resolver.current = null
    setOpen(false)
  }

  const danger = options?.tone === 'danger'

  return (
    <ConfirmContext value={confirm}>
      {children}
      <Dialog open={open} onClose={() => answer(false)} className="relative z-50">
        <DialogBackdrop transition className="fixed inset-0 bg-stone-900/40 transition duration-150 data-closed:opacity-0" />
        <div className="fixed inset-0 flex items-end justify-center p-4 sm:items-center">
          <DialogPanel
            transition
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl transition duration-150 data-closed:translate-y-2 data-closed:opacity-0"
          >
            <div className="flex gap-4">
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-full ${danger ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-700'}`}
              >
                <Icon name="alert" size={20} />
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-base font-semibold text-stone-900">{options?.title}</DialogTitle>
                {options?.message && <div className="mt-1.5 text-sm text-stone-600">{options.message}</div>}
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button onClick={() => answer(false)}>{options?.cancelLabel ?? 'Cancel'}</Button>
              <Button
                variant="primary"
                autoFocus
                className={danger ? 'bg-red-600 hover:bg-red-700' : ''}
                onClick={() => answer(true)}
              >
                {options?.confirmLabel}
              </Button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </ConfirmContext>
  )
}

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return context
}

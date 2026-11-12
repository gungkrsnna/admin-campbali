import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { errorText } from '../lib/api'

type Toast = { id: number; kind: 'success' | 'error'; text: string }
type ToastApi = { success: (text: string) => void; error: (error: unknown) => void }

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random()
    setToasts((list) => [...list, { id, kind, text }])
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), kind === 'error' ? 8000 : 3000)
  }, [])

  const [toastApi] = useState<ToastApi>(() => ({
    success: (text) => push('success', text),
    error: (error) => push('error', errorText(error)),
  }))

  return (
    <ToastContext value={toastApi}>
      {children}
      <div className="fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-md px-4 py-3 text-sm shadow-lg ${
              toast.kind === 'success' ? 'bg-brand-800 text-white' : 'border border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside <ToastProvider>')
  return context
}

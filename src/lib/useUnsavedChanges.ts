import { useEffect, useRef } from 'react'
import { useBlocker } from 'react-router'
import { useConfirm } from '../components/ConfirmDialog'

/**
 * Warns before leaving a page with unsaved changes: inside the admin with our own dialog,
 * and when closing or reloading the tab with the browser's built-in prompt (the only option there).
 * Call `allowNavigation()` right before navigating away on purpose (after saving or deleting).
 */
export function useUnsavedChanges(dirty: boolean) {
  const confirm = useConfirm()
  const allowed = useRef(false)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !allowed.current && currentLocation.pathname !== nextLocation.pathname)

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    confirm({
      title: 'Leave without saving?',
      message: 'Your changes on this page haven’t been saved yet.',
      confirmLabel: 'Leave page',
      cancelLabel: 'Keep editing',
      tone: 'danger',
    }).then((leave) => (leave ? blocker.proceed() : blocker.reset()))
  }, [blocker, confirm])

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  return {
    allowNavigation: () => {
      allowed.current = true
    },
  }
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/Toast'
import { api } from './api'

type Ordered = { sort_order: number }

/**
 * Saves a list in a new order (from drag and drop): renumbers it 0…n and saves only the
 * rows whose position changed. The cached list updates immediately, so the dropped row
 * stays where it was put; it rolls back if saving fails.
 */
export function useReorder<T extends Ordered>(
  resource: string,
  key: (item: T) => string,
  save: (item: T, sortOrder: number) => Promise<unknown> = (item, sort_order) =>
    api(`/${resource}/${key(item)}`, { method: 'PATCH', body: { sort_order } }),
) {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: (next: T[]) => Promise.all(next.map((item, position) => (item.sort_order === position ? null : save(item, position)))),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: [resource] })
      const previous = queryClient.getQueryData<T[]>([resource])
      queryClient.setQueryData<T[]>([resource], next.map((item, position) => ({ ...item, sort_order: position })))
      return { previous }
    },
    onSuccess: () => toast.success('Order saved. Publish to show it on the website.'),
    onError: (error, _next, context) => {
      if (context?.previous) queryClient.setQueryData([resource], context.previous)
      toast.error(error)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [resource] }),
  })
}

export function nextSortOrder(items: Ordered[] | undefined) {
  return items?.length ? Math.max(...items.map((item) => item.sort_order)) + 1 : 0
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/Toast'
import { api } from './api'

/**
 * Draft and publish: saving anywhere in the admin only changes the draft. The website shows
 * the last published version until someone publishes again (backend: routes/admin/publish.ts).
 */

export type Change = {
  area: 'page' | 'category' | 'product' | 'testimonial' | 'faq' | 'milestone' | 'settings'
  kind: 'added' | 'edited' | 'removed' | 'reordered'
  label: string
  id?: string
}

export type PublishStatus = {
  lastPublished: { at: string; by: string | null } | null
  changes: Change[]
}

export type Release = { id: number; created_at: string; published_by_email: string | null }

/** Shown after every save, so it's clear the website hasn't changed yet. */
export const SAVED_AS_DRAFT = 'Saved. Publish to show it on the website.'
export const DELETED_AS_DRAFT = 'Deleted. Publish to remove it from the website.'

export const publishStatusKey = ['publish-status'] as const

export function usePublishStatus() {
  return useQuery({ queryKey: publishStatusKey, queryFn: () => api<PublishStatus>('/publish'), staleTime: 0 })
}

export function usePublish() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: () => api<{ at: string; siteRefreshed: boolean }>('/publish', { method: 'POST' }),
    onSuccess: (result) => {
      toast.success(result.siteRefreshed ? 'Published. The website now shows your changes.' : 'Published. The website will show your changes within an hour.')
      queryClient.invalidateQueries({ queryKey: publishStatusKey })
      queryClient.invalidateQueries({ queryKey: ['releases'] })
    },
    onError: toast.error,
  })
}

/** Names of the page text sections, as the admin shows them. */
const sectionNames: Record<string, string> = {
  meta: 'Browser tab & Google',
  nav: 'Menu',
  home: 'Home',
  story: 'Our Story',
  ethos: 'Ethos',
  products: 'Products pages',
  inquiry: 'My List & messages',
  community: 'Community',
  contact: 'Contact',
  footer: 'Footer',
  notFound: 'Page not found',
  comingSoon: 'Coming soon',
  images: 'Page photos',
}

export const areaInfo: Record<Change['area'], { title: string; to: string }> = {
  page: { title: 'Site Editor', to: '/pages' },
  product: { title: 'Products', to: '/products' },
  category: { title: 'Categories', to: '/categories' },
  testimonial: { title: 'Testimonials', to: '/testimonials' },
  faq: { title: 'FAQs', to: '/faqs' },
  milestone: { title: 'Milestones', to: '/milestones' },
  settings: { title: 'Site Settings', to: '/settings' },
}

export function changeTitle(change: Change) {
  if (change.area === 'page') return sectionNames[change.label] ?? change.label
  if (change.kind === 'reordered') return 'New order'
  return change.label
}

export const kindLabel: Record<Change['kind'], string> = {
  added: 'New',
  edited: 'Edited',
  removed: 'Removed',
  reordered: 'Reordered',
}

/** Where to open a change in the admin. */
export function changeLink(change: Change) {
  if (change.area === 'product' && change.id) return `/products/${change.id}`
  return areaInfo[change.area].to
}

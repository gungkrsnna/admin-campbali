// Shapes returned by the backend admin API (see supabase/migrations).

export type Locale = 'en' | 'id'
export const locales: Locale[] = ['en', 'id']
export const localeLabels: Record<Locale, string> = { en: 'English', id: 'Indonesian' }

export type Localized = Record<Locale, string>
export const emptyLocalized = (): Localized => ({ en: '', id: '' })

type Timestamps = { created_at: string; updated_at: string }

export type Category = Timestamps & { slug: string; name: Localized; sort_order: number }

export type Variant = { id?: string; code: string; size: string; sort_order?: number }

export type Product = Timestamps & {
  id: string
  slug: string
  category_slug: string
  name: Localized
  summary: Localized
  description: Localized
  image_url: string | null
  sort_order: number
  is_published: boolean
  variants: Variant[]
}

export type Testimonial = Timestamps & {
  id: string
  quote: Localized
  name: string
  role: Localized
  sort_order: number
  is_published: boolean
}

export type Faq = Timestamps & {
  id: string
  question: Localized
  answer: Localized
  sort_order: number
  is_published: boolean
}

export type Milestone = Timestamps & {
  id: string
  year: string
  title: Localized
  text: Localized
  sort_order: number
  is_published: boolean
}

export type SiteSettings = {
  name: string
  whatsapp_number: string
  email: string
  location: string
  instagram_url: string
  updated_at: string
}

export type PageSection = { section: string; content: Record<string, unknown>; updated_at: string }

import type { User } from '@supabase/supabase-js'
import { useQueries } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { Icon, type IconName } from '../components/icons'
import { Card, StatusBadge } from '../components/ui'
import { api } from '../lib/api'
import { env } from '../lib/env'
import { usePublishStatus } from '../lib/publish'
import { timeAgo } from '../lib/time'
import type { Faq, Milestone, Product, SiteSettings, Testimonial } from '../lib/types'

/** One accent per content type, drawn from the brand's earthy palette: leaf, gold, lagoon, terracotta. */
const tones = {
  green: { chip: 'bg-brand-50 text-brand-700', bar: 'bg-brand-600', dot: 'bg-brand-600', hover: 'group-hover:border-brand-600/40' },
  gold: { chip: 'bg-amber-50 text-amber-700', bar: 'bg-amber-500', dot: 'bg-amber-500', hover: 'group-hover:border-amber-500/50' },
  teal: { chip: 'bg-teal-50 text-teal-700', bar: 'bg-teal-500', dot: 'bg-teal-500', hover: 'group-hover:border-teal-500/50' },
  terracotta: { chip: 'bg-orange-50 text-orange-700', bar: 'bg-orange-500', dot: 'bg-orange-500', hover: 'group-hover:border-orange-500/50' },
} as const
type Tone = keyof typeof tones

// Same query keys as the list pages, so the dashboard shares their cache.
const resources = [
  { key: 'products', label: 'Products', to: '/products', icon: 'product', tone: 'green' },
  { key: 'testimonials', label: 'Testimonials', to: '/testimonials', icon: 'quote', tone: 'gold' },
  { key: 'faqs', label: 'FAQs', to: '/faqs', icon: 'faq', tone: 'teal' },
  { key: 'milestones', label: 'Milestones', to: '/milestones', icon: 'milestone', tone: 'terracotta' },
] as const satisfies readonly { key: string; label: string; to: string; icon: IconName; tone: Tone }[]

type Row = { id: string; is_published: boolean; updated_at: string }
type Warning = { text: string; action: string; to: string }
type Recent = { id: string; kind: string; tone: Tone; title: string; to: string; updatedAt: string; published: boolean }

export function Dashboard() {
  const { session } = useAuth()
  const lists = useQueries({
    queries: resources.map((r) => ({ queryKey: [r.key], queryFn: () => api<Row[]>(`/${r.key}`) })),
  })
  const [settings] = useQueries({ queries: [{ queryKey: ['settings'], queryFn: () => api<SiteSettings>('/settings') }] })

  const products = lists[0].data as Product[] | undefined
  const testimonials = lists[1].data as Testimonial[] | undefined
  const faqs = lists[2].data as Faq[] | undefined
  const milestones = lists[3].data as Milestone[] | undefined
  const loaded = lists.every((l) => l.data) && Boolean(settings.data)
  const status = usePublishStatus()

  const warnings: Warning[] = []
  const pending = status.data?.changes.length ?? 0
  if (status.data && !status.data.lastPublished)
    warnings.push({ text: 'The website still shows its built-in content. Publish once to show the content managed here.', action: 'Review and publish', to: '/publish' })
  else if (pending)
    warnings.push({ text: `${pending} saved ${pending === 1 ? 'change is' : 'changes are'} not on the website yet.`, action: 'Review and publish', to: '/publish' })
  if (testimonials?.length && testimonials.every((t) => !t.is_published))
    warnings.push({
      text: 'All testimonials are hidden. The current ones are placeholders, so replace them with real testimonials before showing them.',
      action: 'Review testimonials',
      to: '/testimonials',
    })
  if (settings.data && !settings.data.whatsapp_number)
    warnings.push({ text: "No WhatsApp number yet, so the Order via WhatsApp button won't appear.", action: 'Add number', to: '/settings' })
  if (settings.data && !settings.data.instagram_url) warnings.push({ text: 'No Instagram URL yet.', action: 'Add link', to: '/settings' })
  const noImage = products?.filter((p) => !p.image_url).length ?? 0
  if (noImage) warnings.push({ text: `${noImage} ${noImage === 1 ? 'product has' : 'products have'} no image.`, action: 'View products', to: '/products' })

  const recent: Recent[] = [
    ...(products ?? []).map((p) => ({ id: p.id, kind: 'Product', tone: 'green' as const, title: p.name.en, to: `/products/${p.id}`, updatedAt: p.updated_at, published: p.is_published })),
    ...(testimonials ?? []).map((t) => ({ id: t.id, kind: 'Testimonial', tone: 'gold' as const, title: t.name, to: '/testimonials', updatedAt: t.updated_at, published: t.is_published })),
    ...(faqs ?? []).map((f) => ({ id: f.id, kind: 'FAQ', tone: 'teal' as const, title: f.question.en, to: '/faqs', updatedAt: f.updated_at, published: f.is_published })),
    ...(milestones ?? []).map((m) => ({ id: m.id, kind: 'Milestone', tone: 'terracotta' as const, title: `${m.year} · ${m.title.en}`, to: '/milestones', updatedAt: m.updated_at, published: m.is_published })),
  ]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6)

  return (
    <>
      <Greeting user={session?.user} loaded={Boolean(loaded)} attention={warnings.length} />

      {/* Counts */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {resources.map((resource, i) => {
          const rows = lists[i].data
          const tone = tones[resource.tone]
          const published = rows?.filter((r) => r.is_published).length ?? 0
          const share = rows?.length ? (published / rows.length) * 100 : 0
          return (
            <Link key={resource.key} to={resource.to} className="group rounded-lg focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:outline-none">
              <Card className={`h-full p-4 transition group-hover:shadow-sm sm:p-5 ${tone.hover}`}>
                <div className="flex items-center justify-between text-stone-500">
                  <p className="text-sm">{resource.label}</p>
                  <span className={`flex size-9 items-center justify-center rounded-lg ${tone.chip}`}>
                    <Icon name={resource.icon} size={18} />
                  </span>
                </div>
                {rows ? (
                  <>
                    <p className="mt-2 text-3xl font-semibold text-stone-900 tabular-nums">{rows.length}</p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100" aria-hidden>
                      <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${share}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-stone-500">
                      {published} visible · {rows.length - published} hidden
                    </p>
                  </>
                ) : (
                  <div className="mt-2 animate-pulse space-y-3" aria-label="Loading">
                    <div className="h-8 w-10 rounded bg-stone-200" />
                    <div className="h-1.5 rounded-full bg-stone-200" />
                    <div className="h-3 w-24 rounded bg-stone-200" />
                  </div>
                )}
              </Card>
            </Link>
          )
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Needs attention */}
          {loaded && (
            <Section
              title={warnings.length ? 'Needs attention' : 'All set'}
              count={warnings.length || undefined}
              headerClass={warnings.length ? 'bg-amber-50 text-amber-900 border-amber-100' : 'bg-brand-50 text-brand-800 border-brand-100'}
            >
              {warnings.length ? (
                <ul className="divide-y divide-stone-100">
                  {warnings.map((w) => (
                    <li key={w.text} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-4">
                      <span className="flex flex-1 items-start gap-3 text-sm text-stone-700">
                        <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-amber-600" />
                        {w.text}
                      </span>
                      <Link
                        to={w.to}
                        className="ml-7 w-fit shrink-0 rounded-md bg-amber-100/70 px-2.5 py-1 text-xs font-medium text-amber-900 transition hover:bg-amber-200/70 sm:ml-0"
                      >
                        {w.action} →
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex items-center gap-3 px-5 py-4 text-sm text-stone-600">
                  <Icon name="check" size={18} className="text-brand-600" />
                  Nothing needs your attention right now.
                </p>
              )}
            </Section>
          )}

          {/* Recently updated */}
          <Section title="Recently updated">
            {recent.length ? (
              <ul className="divide-y divide-stone-100">
                {recent.map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    <Link to={item.to} className="flex items-center gap-3 px-5 py-3 transition hover:bg-stone-50">
                      <span aria-hidden className={`size-2 shrink-0 rounded-full ${tones[item.tone].dot}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-stone-800">{item.title}</p>
                        <p className="text-xs text-stone-500">
                          {item.kind} · <time dateTime={item.updatedAt}>{timeAgo(item.updatedAt)}</time>
                        </p>
                      </div>
                      <StatusBadge published={item.published} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-stone-500">{loaded ? 'No content yet.' : 'Loading…'}</p>
            )}
          </Section>
        </div>

        {/* Quick actions */}
        <Section title="Quick actions">
          <div className="flex flex-col p-2">
            <QuickAction to="/products/new" icon="plus" tone="green" label="Add a product" />
            <QuickAction to="/pages" icon="page" tone="terracotta" label="Open the Site Editor" />
            <QuickAction to="/faqs" icon="faq" tone="teal" label="Manage FAQs" />
            <QuickAction to="/settings" icon="settings" tone="gold" label="Contact details" />
            {env.siteUrl && <QuickAction href={env.siteUrl} icon="external" tone="green" label="View the website" />}
          </div>
        </Section>
      </div>
    </>
  )
}

/** Plain welcome banner: the greeting and one line about the site's state. */
function Greeting({ user, loaded, attention }: { user?: User; loaded: boolean; attention: number }) {
  // Read the clock once per visit so re-renders don't change the greeting under the reader.
  const [now] = useState(() => new Date())
  return (
    <section className="rounded-xl bg-forest px-6 py-7 text-cream sm:px-8">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {greetingFor(now)}, <span className="text-gold">{displayName(user)}</span>
      </h1>
      <p className="mt-2 min-h-5 text-sm text-cream/70">
        {loaded && (attention ? 'Some things still need finishing. See the list below.' : 'Everything is published and up to date.')}
      </p>
    </section>
  )
}

function greetingFor(now: Date) {
  const hour = now.getHours()
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** The admin's name (set with `npm run create-admin -- email "Name"`), else their email's first word, capitalised. */
function displayName(user?: User) {
  const name = (user?.user_metadata?.name as string | undefined)?.trim()
  if (name) return name.split(/\s+/)[0]
  const local = user?.email?.split('@')[0].split(/[._+-]/)[0] ?? ''
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : 'there'
}

function Section({ title, count, headerClass = 'text-stone-800 border-stone-100', children }: { title: string; count?: number; headerClass?: string; children: ReactNode }) {
  return (
    <section className="h-fit overflow-hidden rounded-lg border border-stone-200 bg-white shadow-xs">
      <h2 className={`flex items-center gap-2 border-b px-5 py-3 text-sm font-semibold ${headerClass}`}>
        {title}
        {count !== undefined && <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-xs font-medium text-amber-900">{count}</span>}
      </h2>
      {children}
    </section>
  )
}

function QuickAction({ icon, tone, label, to, href }: { icon: IconName; tone: Tone; label: string; to?: string; href?: string }) {
  const content = (
    <>
      <span className={`flex size-9 items-center justify-center rounded-lg transition ${tones[tone].chip}`}>
        <Icon name={icon} size={18} />
      </span>
      <span className="flex-1">{label}</span>
      <Icon name="arrowRight" size={16} className="text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-stone-500" />
    </>
  )
  const className = 'group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-stone-700 transition hover:bg-stone-50'
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {content}
    </a>
  ) : (
    <Link to={to!} className={className}>
      {content}
    </Link>
  )
}

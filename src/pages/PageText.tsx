import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useConfirm } from '../components/ConfirmDialog'
import { Icon } from '../components/icons'
import { ImageUpload } from '../components/ImageUpload'
import { Select } from '../components/Select'
import { Thumbnail } from '../components/Thumbnail'
import { useToast } from '../components/Toast'
import { Button, ErrorBox, Loading, PageHeader } from '../components/ui'
import { api } from '../lib/api'
import { env } from '../lib/env'
import { imageSlots, managedPaths, pageMap, roleInfo, unusedPaths, type ImageSlot, type ListSpec, type PageSpec, type Role, type SectionSpec, type Spec, type TextSpec } from '../lib/pageMap'
import { SAVED_AS_DRAFT, usePublishStatus } from '../lib/publish'
import { locales, type Locale, type PageSection } from '../lib/types'
import { useUnsavedChanges } from '../lib/useUnsavedChanges'

type Content = Record<string, unknown>
/** All page texts of one language: dictionary section → content. */
type Texts = Record<string, Content>
type All = Record<Locale, Texts>
type Device = 'desktop' | 'mobile'

const languageName: Record<Locale, string> = { en: 'English', id: 'Indonesian' }

// ---------- Reading and writing "home.titleLead"-style paths ----------

const split = (path: string) => path.split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : part))

function getPath(texts: Texts, path: string): unknown {
  return split(path).reduce<unknown>((node, key) => (node as Record<string | number, unknown> | undefined)?.[key], texts)
}

function setIn(value: unknown, keys: (string | number)[], next: unknown): unknown {
  if (keys.length === 0) return next
  const [key, ...rest] = keys
  const copy = (Array.isArray(value) ? [...value] : { ...(value as object) }) as Record<string | number, unknown>
  copy[key] = setIn(copy[key], rest, next)
  return copy
}

const setPath = (texts: Texts, path: string, next: unknown) => setIn(texts, split(path), next) as Texts

/**
 * Puts one path back to its saved state: the saved value, or no value at all if none was saved
 * (removing objects that become empty), so an undone edit no longer counts as a change.
 */
function resetPath(draft: Texts, saved: Texts, path: string): Texts {
  const savedValue = getPath(saved, path)
  if (savedValue !== undefined) return setPath(draft, path, savedValue)
  const keys = split(path)
  const without = (value: unknown, rest: (string | number)[], depth: number): unknown => {
    if (value === null || typeof value !== 'object') return value
    const [key, ...more] = rest
    const copy = { ...(value as Record<string | number, unknown>) }
    if (more.length === 0) delete copy[key]
    else copy[key] = without(copy[key], more, depth + 1)
    const emptied = Object.keys(copy).length === 0 && getPath(saved, keys.slice(0, depth).join('.')) === undefined
    return depth > 0 && emptied ? undefined : copy
  }
  const next = without(draft, keys, 0) as Texts
  // Drop a now-empty section that was never saved.
  return Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined)) as Texts
}

/** Every text (leaf string) path in the data, e.g. "home.stats.0.value". */
function leafPaths(value: unknown, prefix = ''): string[] {
  if (value !== null && typeof value === 'object')
    return Object.entries(value as object).flatMap(([key, child]) => leafPaths(child, prefix ? `${prefix}.${key}` : key))
  return [prefix]
}

const humanize = (path: string) =>
  path
    .split('.')
    .map((part) => (/^\d+$/.test(part) ? `#${Number(part) + 1}` : part.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()))
    .join(' › ')

// ---------- Page photos (stored as "images.<slot>", the same address in both languages) ----------

const imagePath = (slot: ImageSlot) => `images.${slot}`
const slotOf = (path: string) => (path.startsWith('images.') && path.slice(7) in imageSlots ? (path.slice(7) as ImageSlot) : null)

/** The photo address a slot shows: the saved one, else the site's built-in photo. */
function imageAddress(texts: Texts, slot: ImageSlot) {
  const value = getPath(texts, imagePath(slot))
  return typeof value === 'string' && value ? value : imageSlots[slot].original
}

const pagePhotos = (page: PageSpec) => page.sections.flatMap((section) => (section.image ? [{ slot: section.image, section: section.title }] : []))

const isHidden = (spec: TextSpec | ListSpec) => (spec.kind === 'text' ? Boolean(roleInfo[spec.role].hidden) : spec.fields.every((f) => roleInfo[f.role].hidden))

// ---------- Where each text appears ----------

type Location = { page: string; pageId: string; section: string }

function buildLocations() {
  const where = new Map<string, Location[]>()
  for (const page of pageMap)
    for (const section of page.sections)
      for (const item of section.items) {
        if (item.kind === 'managed') continue
        const list = where.get(item.path) ?? []
        list.push({ page: page.title, pageId: page.id, section: section.title })
        where.set(item.path, list)
      }
  return where
}

/** The page-map entry describing a path; list items ("home.stats.0.value") get their own label. */
function describe(path: string): { spec: TextSpec | ListSpec; listPath?: string } {
  const slot = slotOf(path)
  if (slot) return { spec: { kind: 'text', path, label: imageSlots[slot].label, role: 'alt' } }
  for (const page of pageMap)
    for (const section of page.sections)
      for (const item of section.items) {
        if (item.kind === 'managed') continue
        if (item.path === path) return { spec: item }
        if (item.kind === 'list' && path.startsWith(`${item.path}.`)) {
          const [index, key] = path.slice(item.path.length + 1).split('.')
          const field = item.fields.find((f) => f.key === key) ?? item.fields[0]
          const label = `${item.item} ${Number(index) + 1}${item.fields.length > 1 ? `: ${field.label}` : ''}`
          return { spec: { kind: 'text', path, label, role: field.role }, listPath: item.path }
        }
      }
  return { spec: { kind: 'text', path, label: humanize(path), role: 'body' } }
}

/** Texts in the data that the page map doesn't place, shown under "Other texts" so nothing is unreachable. */
function otherTextsPage(saved: All): PageSpec | null {
  const placed = [...buildLocations().keys(), ...unusedPaths, ...managedPaths, 'images']
  const isPlaced = (path: string) => placed.some((p) => path === p || path.startsWith(`${p}.`))
  const leftover = [...new Set(locales.flatMap((l) => leafPaths(saved[l])))].filter((p) => p && !isPlaced(p))
  if (!leftover.length) return null
  return {
    id: 'other',
    title: 'Other texts',
    description: 'Texts whose place on the site isn’t described yet.',
    group: 'other',
    sections: [{ title: 'Unplaced texts', items: leftover.map((path) => ({ kind: 'text', path, label: humanize(path), role: 'body' }) satisfies TextSpec) }],
  }
}

const headerFooter = pageMap.find((p) => p.id === 'header-footer')!

// ---------- Page ----------

export function PageText() {
  const results = useQueries({
    queries: locales.map((locale) => ({ queryKey: ['pages', locale], queryFn: () => api<PageSection[]>(`/pages/${locale}`) })),
  })
  const error = results.find((r) => r.error)?.error
  if (error) return <ErrorBox error={error} />
  if (results.some((r) => !r.data)) return <Loading />

  const saved = Object.fromEntries(
    locales.map((locale, i) => [locale, Object.fromEntries(results[i].data!.map((row) => [row.section, row.content]))]),
  ) as All
  return <PageCopyEditor saved={saved} />
}

function PageCopyEditor({ saved }: { saved: All }) {
  const [drafts, setDrafts] = useState<All>(saved)
  const [pageId, setPageId] = useState('home')
  const [locale, setLocale] = useState<Locale>('en')
  const [device, setDevice] = useState<Device>('desktop')
  const [selected, setSelected] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()

  const locations = useMemo(() => buildLocations(), [])
  const sitePages = pageMap.filter((p) => p.group === 'page' && p.id !== 'header-footer')
  const formPages = useMemo(() => {
    const other = otherTextsPage(saved)
    return [...pageMap.filter((p) => p.group === 'other'), ...(other ? [other] : [])]
  }, [saved])
  const page = [...sitePages, ...formPages].find((p) => p.id === pageId) ?? sitePages[0]

  // Which (language, dictionary section) pairs differ from what's saved.
  const changedSections = locales.flatMap((l) =>
    Object.keys(drafts[l])
      .filter((section) => JSON.stringify(drafts[l][section]) !== JSON.stringify(saved[l][section]))
      .map((section) => ({ locale: l, section })),
  )
  const dirty = changedSections.length > 0
  useUnsavedChanges(dirty)

  const isChanged = useCallback(
    (path: string) => locales.some((l) => JSON.stringify(getPath(drafts[l], path)) !== JSON.stringify(getPath(saved[l], path))),
    [drafts, saved],
  )
  const update = (l: Locale, path: string, value: string) => setDrafts((d) => ({ ...d, [l]: setPath(d[l], path, value) }))
  const reset = (path: string) => setDrafts((d) => Object.fromEntries(locales.map((l) => [l, resetPath(d[l], saved[l], path)])) as All)
  const editedIn = (p: PageSpec) =>
    new Set([
      ...p.sections.flatMap((s) => s.items.flatMap((i) => (i.kind !== 'managed' && isChanged(i.path) ? [i.path] : []))),
      ...pagePhotos(p).flatMap(({ slot }) => (isChanged(imagePath(slot)) ? [imagePath(slot)] : [])),
    ]).size

  const save = useMutation({
    mutationFn: () => Promise.all(changedSections.map(({ locale: l, section }) => api(`/pages/${l}/${section}`, { method: 'PUT', body: drafts[l][section] }))),
    onSuccess: () => {
      toast.success(SAVED_AS_DRAFT)
      queryClient.invalidateQueries({ queryKey: ['pages'] })
    },
    onError: toast.error,
  })

  async function discard() {
    if (await confirm({ title: 'Discard changes?', message: 'All text you changed since the last save will be restored.', confirmLabel: 'Discard', tone: 'danger' }))
      setDrafts(saved)
  }

  const ctx: RowContext = { drafts, saved, locations, isChanged, update, reset }
  const publishStatus = usePublishStatus()
  const waiting = publishStatus.data ? (publishStatus.data.lastPublished ? publishStatus.data.changes.length : 1) : 0
  const isSitePage = page.group === 'page'

  return (
    <>
      <PageHeader
        title="Site Editor"
        actions={
          <>
            {!dirty && waiting > 0 && (
              <Link to="/publish" className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-xs transition hover:bg-stone-50">
                Review and publish
                <span className="rounded-full bg-amber-100 px-1.5 text-xs text-amber-900 tabular-nums">{waiting}</span>
              </Link>
            )}
            {dirty && (
              <>
                <span className="hidden items-center gap-1.5 self-center text-xs text-amber-700 sm:flex">
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  Unsaved changes
                </span>
                <Button onClick={discard} disabled={save.isPending}>
                  Discard
                </Button>
              </>
            )}
            <Button variant="primary" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      />

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Select
          label="Page"
          hideLabel
          className="w-full sm:w-64"
          value={page.id}
          onChange={(id) => {
            setPageId(id)
            setSelected(null)
          }}
          options={[
            ...sitePages.map((p) => ({ value: p.id, label: p.title, meta: editedIn(p) ? `${editedIn(p)} edited` : undefined })),
            ...formPages.map((p) => ({ value: p.id, label: p.title, meta: editedIn(p) ? `${editedIn(p)} edited` : 'Not on a page' })),
          ]}
        />
        {isSitePage && (
          <>
            <Segmented label="Language" value={locale} onChange={setLocale} options={locales.map((l) => ({ value: l, label: l.toUpperCase(), title: languageName[l] }))} />
            <Segmented
              label="Screen"
              value={device}
              onChange={setDevice}
              options={[
                { value: 'desktop', label: 'Desktop' },
                { value: 'mobile', label: 'Phone' },
              ]}
            />
          </>
        )}
      </div>

      {isSitePage ? (
        <VisualEditor
          key={`${page.id}-${locale}`}
          page={page}
          locale={locale}
          device={device}
          ctx={ctx}
          selected={selected}
          onSelect={setSelected}
          onOpen={(id, path) => {
            setPageId(id)
            setSelected(path)
          }}
        />
      ) : (
        <PageView page={page} ctx={ctx} />
      )}
    </>
  )
}

function Segmented<V extends string>({ label, value, onChange, options }: { label: string; value: V; onChange: (v: V) => void; options: { value: V; label: string; title?: string }[] }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex h-[38px] rounded-md border border-stone-300 bg-white p-0.5 shadow-xs">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`rounded px-3 text-sm transition ${value === o.value ? 'bg-brand-700 font-medium text-white' : 'text-stone-600 hover:bg-stone-100'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ---------- Visual editor: the website in a frame, plus a side panel ----------

type SiteMessage = { source: 'campbali-site'; type: 'ready' | 'paths' | 'select'; paths?: string[]; path?: string }

function VisualEditor({
  page,
  locale,
  device,
  ctx,
  selected,
  onSelect,
  onOpen,
}: {
  page: PageSpec
  locale: Locale
  device: Device
  ctx: RowContext
  selected: string | null
  onSelect: (path: string | null) => void
  onOpen: (pageId: string, path: string) => void
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [present, setPresent] = useState<Set<string> | null>(null)
  const [slow, setSlow] = useState(false)
  const siteOrigin = env.siteUrl ? new URL(env.siteUrl).origin : ''
  // The website shows drafts only to someone with a fresh token from the backend.
  const preview = useQuery({
    queryKey: ['preview-token'],
    queryFn: () => api<{ token: string; expires: string }>('/publish/preview-token', { method: 'POST' }),
    staleTime: 30 * 60_000,
  })
  const src = preview.data
    ? `${env.siteUrl}/api/editor?path=${encodeURIComponent(page.url ?? '')}&lang=${locale}&token=${encodeURIComponent(preview.data.token)}`
    : undefined

  const send = useCallback((message: Record<string, unknown>) => frame.current?.contentWindow?.postMessage({ source: 'campbali-admin', ...message }, siteOrigin), [siteOrigin])

  const photos = useMemo(() => pagePhotos(page), [page])

  // Labels shown on hover in the page ("Heading, line 1"), for every text and photo on the page.
  const labels = useMemo(() => {
    if (!present) return {}
    return Object.fromEntries([...present].map((path) => [path, describe(path).spec.label]))
  }, [present])

  // The photos the frame should recognise, by the address the page was rendered with (the saved one).
  const savedPhotos = useMemo(() => Object.fromEntries(photos.map(({ slot }) => [imagePath(slot), imageAddress(ctx.saved.en, slot)])), [photos, ctx.saved])

  // The page's texts and photos as currently edited (unsaved changes included), sent to the frame.
  const values = useMemo(() => {
    if (!present) return {}
    const texts = [...present].flatMap((path) => {
      const value = getPath(ctx.drafts[locale], path)
      return typeof value === 'string' && !slotOf(path) ? [[path, value]] : []
    })
    const images = photos.map(({ slot }) => [imagePath(slot), imageAddress(ctx.drafts.en, slot)])
    return Object.fromEntries([...texts, ...images]) as Record<string, string>
  }, [present, ctx.drafts, locale, photos])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as SiteMessage
      if (event.origin !== siteOrigin || data?.source !== 'campbali-site') return
      if ((data.type === 'ready' || data.type === 'paths') && data.paths) setPresent(new Set(data.paths))
      if (data.type === 'select' && data.path) onSelect(data.path)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [siteOrigin, onSelect])

  // Order matters: the frame must know the photos before it is told what to show.
  useEffect(() => {
    if (present) send({ type: 'images', images: savedPhotos })
  }, [present, savedPhotos, send])

  useEffect(() => {
    if (present) send({ type: 'labels', labels })
  }, [present, labels, send])

  useEffect(() => {
    if (present) send({ type: 'apply', values })
  }, [present, values, send])

  useEffect(() => {
    if (present) send({ type: 'select', path: selected, scroll: true })
  }, [present, selected, send])

  // The first load of a page can take a while in development; say so after a moment.
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 12000)
    return () => window.clearTimeout(timer)
  }, [])

  if (!env.siteUrl) return <ErrorBox error={new Error('The website address (VITE_SITE_URL) isn’t set in admin/.env.')} />
  if (preview.error) return <ErrorBox error={preview.error} />

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <Canvas device={device} loading={!present} slow={slow}>
        <iframe ref={frame} src={src} title={`${page.title} (editor)`} className="block size-full border-0 bg-white" />
      </Canvas>
      <SidePanel page={page} locale={locale} ctx={ctx} present={present} selected={selected} onSelect={onSelect} onOpen={onOpen} />
    </div>
  )
}

/** Shows the frame at a real screen width (1280 px desktop, 390 px phone), scaled to fit. */
function Canvas({ device, loading, slow, children }: { device: Device; loading: boolean; slow: boolean; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const element = box.current!
    const observer = new ResizeObserver(() => setSize({ width: element.clientWidth, height: element.clientHeight }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const frameWidth = device === 'desktop' ? 1280 : 390
  const available = device === 'desktop' ? size.width : Math.min(size.width, frameWidth)
  const scale = available ? Math.min(1, available / frameWidth) : 1

  return (
    <div
      ref={box}
      className="relative h-[calc(100vh-13rem)] min-h-[28rem] overflow-hidden rounded-lg border border-stone-200 bg-stone-200/60 shadow-xs xl:sticky xl:top-[calc(var(--page-header-h,4rem)+1rem)]"
    >
      <div
        className={`absolute top-0 origin-top-left overflow-hidden bg-white ${device === 'mobile' ? 'left-1/2 rounded-lg shadow-lg ring-1 ring-stone-300' : 'left-0'}`}
        style={{
          width: frameWidth,
          height: size.height / scale,
          transform: device === 'mobile' ? `translateX(-50%) scale(${scale})` : `scale(${scale})`,
          transformOrigin: device === 'mobile' ? 'top center' : 'top left',
        }}
      >
        {children}
      </div>
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-stone-50/90 px-6 text-center text-sm text-stone-600">
          <span className="size-5 animate-spin rounded-full border-2 border-stone-300 border-t-brand-700" aria-hidden />
          Loading the page…
          {slow && (
            <span className="max-w-sm text-xs text-stone-500">
              Taking long? The website must be running for the editor to show it. On your computer, start everything with <code>npm run dev</code>.
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- Side panel ----------

function SidePanel({
  page,
  locale,
  ctx,
  present,
  selected,
  onSelect,
  onOpen,
}: {
  page: PageSpec
  locale: Locale
  ctx: RowContext
  present: Set<string> | null
  selected: string | null
  onSelect: (path: string | null) => void
  onOpen: (pageId: string, path: string) => void
}) {
  const [query, setQuery] = useState('')
  const panelCtx = { ...ctx, compact: true }

  // Everything this page (plus the menu and footer) shows, from the page map.
  const specs = [...page.sections, ...headerFooter.sections].flatMap((section) =>
    section.items.flatMap((item) => (item.kind === 'managed' ? [] : [{ spec: item, section: section.title }])),
  )
  const seen = new Set<string>()
  const unique = specs.filter(({ spec }) => !seen.has(spec.path) && seen.add(spec.path))
  const isPresent = (spec: TextSpec | ListSpec) => present?.has(spec.path) || [...(present ?? [])].some((p) => p.startsWith(`${spec.path}.`))
  const hidden = unique.filter(({ spec }) => isHidden(spec))
  const offScreen = present ? unique.filter(({ spec }) => !isHidden(spec) && !isPresent(spec)) : []
  const managed = page.sections.flatMap((s) => s.items.filter((i) => i.kind === 'managed'))
  const managedUnique = managed.filter((m, i) => managed.findIndex((x) => x.kind === 'managed' && m.kind === 'managed' && x.menu === m.menu) === i)

  return (
    <aside className="flex flex-col gap-4 xl:sticky xl:top-[calc(var(--page-header-h,4rem)+1rem)] xl:max-h-[calc(100vh-var(--page-header-h,4rem)-2rem)] xl:overflow-y-auto">
      {selected && slotOf(selected) ? (
        <SelectedPhoto slot={slotOf(selected)!} ctx={panelCtx} onClose={() => onSelect(null)} />
      ) : selected ? (
        <SelectedText path={selected} locale={locale} ctx={panelCtx} onClose={() => onSelect(null)} />
      ) : (
        <>
          <div className="rounded-lg border border-brand-600/20 bg-brand-50 p-4 text-sm text-brand-900">
            <p className="font-medium">Click any text on the page to edit it.</p>
            <p className="mt-1 text-brand-900/75">Your changes show on the page as you type. Save puts them on the website.</p>
          </div>

          <label className="relative block">
            <span className="sr-only">Find a text</span>
            <Icon name="search" size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-stone-400" />
            <input type="search" placeholder="Find a text on any page" value={query} onChange={(e) => setQuery(e.target.value)} className="w-full pl-9" />
          </label>

          {query.trim() ? (
            <SearchList query={query.trim()} ctx={ctx} locale={locale} onOpen={onOpen} />
          ) : (
            <>
              {pagePhotos(page).length > 0 && (
                <section className="rounded-lg border border-stone-200 bg-white shadow-xs">
                  <header className="border-b border-stone-100 px-4 py-3">
                    <h3 className="text-sm font-semibold text-stone-900">Photos on this page</h3>
                    <p className="text-xs text-stone-500">Click a photo here or on the page to change it.</p>
                  </header>
                  <ul className="grid grid-cols-2 gap-3 p-4">
                    {pagePhotos(page).map(({ slot, section }) => (
                      <li key={slot}>
                        <button type="button" onClick={() => onSelect(imagePath(slot))} className="group flex w-full flex-col gap-1.5 text-left">
                          <span className="relative block">
                            <Thumbnail url={imageAddress(ctx.drafts.en, slot)} className="aspect-[4/3] w-full transition group-hover:ring-2 group-hover:ring-brand-600" />
                            {ctx.isChanged(imagePath(slot)) && (
                              <span className="absolute top-1.5 left-1.5 rounded bg-amber-100 px-1.5 py-px text-[0.68rem] font-medium text-amber-800">Edited</span>
                            )}
                          </span>
                          <span className="text-xs text-stone-600">{section}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <PanelGroup
                title="Not visible on the page"
                description="Photo descriptions, messages and labels for screen readers."
                items={hidden}
                ctx={ctx}
                locale={locale}
                onSelect={onSelect}
              />
              {offScreen.length > 0 && (
                <PanelGroup
                  title="Not on screen right now"
                  description="Shown only in some situations, such as after adding a product or in the phone menu."
                  items={offScreen}
                  ctx={ctx}
                  locale={locale}
                  onSelect={onSelect}
                />
              )}
              {managedUnique.length > 0 && (
                <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-xs">
                  <h3 className="text-sm font-semibold text-stone-900">Edited in other menus</h3>
                  <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                    {managedUnique.map((m) =>
                      m.kind === 'managed' ? (
                        <li key={m.menu}>
                          <Link to={m.to} className="text-brand-700 hover:underline">
                            {m.menu} →
                          </Link>
                        </li>
                      ) : null,
                    )}
                  </ul>
                </section>
              )}
            </>
          )}
        </>
      )}
    </aside>
  )
}

function SelectedText({ path, locale, ctx, onClose }: { path: string; locale: Locale; ctx: RowContext; onClose: () => void }) {
  const { spec } = describe(path)
  const where = ctx.locations.get(spec.kind === 'list' ? spec.path : (describe(path).listPath ?? path)) ?? []
  const here = where[0] ?? { page: '', pageId: '', section: '' }
  return (
    <section className="rounded-lg border border-brand-600/30 bg-white shadow-sm ring-4 ring-brand-50">
      <header className="flex items-start justify-between gap-3 border-b border-stone-100 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-stone-500">{here.page ? `${here.page} › ${here.section}` : 'Text'}</p>
          <h3 className="text-sm font-semibold text-stone-900">Edit text</h3>
        </div>
        <button type="button" onClick={onClose} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100">
          <Icon name="close" size={14} />
          Done
        </button>
      </header>
      <div className="p-4">
        <SpecRow spec={spec} here={here} ctx={ctx} />
        <p className="mt-3 text-xs text-stone-500">
          The page shows the {languageName[locale]} text. Switch the language above to see the other one.
        </p>
      </div>
    </section>
  )
}

/** A page photo: replace it, go back to the original, and its description for Google and screen readers. */
function SelectedPhoto({ slot, ctx, onClose }: { slot: ImageSlot; ctx: RowContext; onClose: () => void }) {
  const info = imageSlots[slot]
  const path = imagePath(slot)
  const current = imageAddress(ctx.drafts.en, slot)
  // A photo is the same in both languages. Going back to the saved photo undoes the edit.
  const setPhoto = (address: string) => (address === imageAddress(ctx.saved.en, slot) ? ctx.reset(path) : locales.forEach((l) => ctx.update(l, path, address)))
  const alt = describe(info.alt).spec
  const altPlace = ctx.locations.get(info.alt)?.[0] ?? { page: '', pageId: '', section: '' }

  return (
    <section className="rounded-lg border border-brand-600/30 bg-white shadow-sm ring-4 ring-brand-50">
      <header className="flex items-start justify-between gap-3 border-b border-stone-100 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-stone-500">{info.label}</p>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
            Change photo
            {ctx.isChanged(path) && <span className="rounded bg-amber-100 px-1.5 py-px text-[0.68rem] font-medium text-amber-800">Edited</span>}
          </h3>
        </div>
        <button type="button" onClick={onClose} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100">
          <Icon name="close" size={14} />
          Done
        </button>
      </header>
      <div className="flex flex-col gap-4 p-4">
        <ImageUpload folder="pages" value={current} allowRemove={false} onChange={(url) => setPhoto(url ?? info.original)} />
        {current !== info.original && (
          <button type="button" onClick={() => setPhoto(info.original)} className="w-fit text-xs font-medium text-brand-700 hover:underline">
            Use the original photo
          </button>
        )}
        <p className="text-xs text-stone-500">The new photo shows on the page straight away. Save puts it on the website. Landscape photos of at least 1600 px wide look best.</p>
        <div className="flex flex-col gap-3 border-t border-stone-100 pt-4">
          {ctx.isChanged(path) && !ctx.isChanged(info.alt) && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">New photo: update its description below so it matches what the photo shows.</p>
          )}
          <SpecRow spec={alt} here={altPlace} ctx={ctx} />
        </div>
      </div>
    </section>
  )
}

function PanelGroup({
  title,
  description,
  items,
  ctx,
  locale,
  onSelect,
}: {
  title: string
  description: string
  items: { spec: TextSpec | ListSpec; section: string }[]
  ctx: RowContext
  locale: Locale
  onSelect: (path: string) => void
}) {
  if (!items.length) return null
  return (
    <section className="rounded-lg border border-stone-200 bg-white shadow-xs">
      <header className="border-b border-stone-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
        <p className="text-xs text-stone-500">{description}</p>
      </header>
      <ul className="divide-y divide-stone-100">
        {items.map(({ spec, section }) => (
          <li key={spec.path}>
            <PanelItem spec={spec} context={section} ctx={ctx} locale={locale} onClick={() => onSelect(spec.path)} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function PanelItem({ spec, context, ctx, locale, onClick }: { spec: TextSpec | ListSpec; context: string; ctx: RowContext; locale: Locale; onClick: () => void }) {
  const value = getPath(ctx.drafts[locale], spec.path)
  const preview = typeof value === 'string' ? value : Array.isArray(value) ? `${value.length} ${spec.kind === 'list' ? spec.item.toLowerCase() : 'item'}s` : ''
  return (
    <button type="button" onClick={onClick} className="flex w-full flex-col gap-0.5 px-4 py-2.5 text-left transition hover:bg-stone-50">
      <span className="flex items-center gap-2 text-sm text-stone-800">
        {spec.label}
        {spec.kind === 'text' && roleInfo[spec.role].name.toLowerCase() !== spec.label.toLowerCase() && (
          <span className="rounded bg-violet-50 px-1.5 py-px text-[0.68rem] font-medium text-violet-700">{roleInfo[spec.role].name}</span>
        )}
        {ctx.isChanged(spec.path) && <span className="rounded bg-amber-100 px-1.5 py-px text-[0.68rem] font-medium text-amber-800">Edited</span>}
      </span>
      <span className="truncate text-xs text-stone-500">
        {context} · {preview || 'empty'}
      </span>
    </button>
  )
}

function SearchList({ query, ctx, locale, onOpen }: { query: string; ctx: RowContext; locale: Locale; onOpen: (pageId: string, path: string) => void }) {
  const needle = query.toLowerCase()
  const seen = new Set<string>()
  const results = pageMap.flatMap((page) =>
    page.sections.flatMap((section) =>
      section.items.flatMap((item) => {
        if (item.kind === 'managed' || seen.has(item.path)) return []
        const text = locales.map((l) => JSON.stringify(getPath(ctx.drafts[l], item.path) ?? '')).join(' ').toLowerCase()
        if (!item.label.toLowerCase().includes(needle) && !text.includes(needle)) return []
        seen.add(item.path)
        // Texts of the menu and footer open on the Home page.
        return [{ spec: item, page: page.id === 'header-footer' ? 'home' : page.id, where: `${page.title} › ${section.title}` }]
      }),
    ),
  )
  if (!results.length) return <p className="rounded-lg border border-dashed border-stone-300 py-8 text-center text-sm text-stone-500">No text matches “{query}”.</p>
  return (
    <section className="rounded-lg border border-stone-200 bg-white shadow-xs">
      <p className="border-b border-stone-100 px-4 py-2.5 text-xs text-stone-500">
        {results.length} {results.length === 1 ? 'text matches' : 'texts match'}. Click one to open it.
      </p>
      <ul className="divide-y divide-stone-100">
        {results.map(({ spec, page, where }) => (
          <li key={spec.path}>
            <PanelItem spec={spec} context={where} ctx={ctx} locale={locale} onClick={() => onOpen(page, spec.path)} />
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---------- Form view (texts that aren't on a page) and shared rows ----------

type RowContext = {
  drafts: All
  saved: All
  locations: Map<string, Location[]>
  isChanged: (path: string) => boolean
  update: (locale: Locale, path: string, value: string) => void
  /** Undoes the edits of one path (both languages). */
  reset: (path: string) => void
  /** Narrow side panel: languages stacked instead of side by side. */
  compact?: boolean
}

function PageView({ page, ctx }: { page: PageSpec; ctx: RowContext }) {
  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-stone-900">{page.title}</h2>
        {page.description && <p className="mt-0.5 max-w-2xl text-sm text-stone-500">{page.description}</p>}
      </div>
      {page.sections.map((section, i) => (
        <SectionCard key={section.title + i} section={section} page={page} ctx={ctx} />
      ))}
    </div>
  )
}

function SectionCard({ section, page, ctx }: { section: SectionSpec; page: PageSpec; ctx: RowContext }) {
  return (
    <section className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-xs">
      <header className="border-b border-stone-100 px-5 py-3.5">
        <h3 className="text-sm font-semibold text-stone-900">{section.title}</h3>
        {section.description && <p className="mt-0.5 text-xs text-stone-500">{section.description}</p>}
      </header>
      <div className={section.image ? 'grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_11rem]' : 'p-5'}>
        <div className="flex min-w-0 flex-col divide-y divide-stone-100">
          {section.items.map((item, i) => (
            <div key={i} className="py-4 first:pt-0 last:pb-0">
              <SpecRow spec={item} here={{ page: page.title, pageId: page.id, section: section.title }} ctx={ctx} />
            </div>
          ))}
          {section.note && <p className="pt-4 text-xs text-stone-500">{section.note}</p>}
        </div>
        {section.image && <Thumbnail url={imageAddress(ctx.drafts.en, section.image)} className="aspect-[4/5] w-full max-w-44" />}
      </div>
    </section>
  )
}

function SpecRow({ spec, here, ctx }: { spec: Spec; here: Location; ctx: RowContext }) {
  if (spec.kind === 'managed') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm">
        <span className="text-stone-600">
          {spec.text} {spec.text.endsWith('s') ? 'are' : 'is'} edited in <b className="font-medium text-stone-800">{spec.menu}</b>.
        </span>
        <Link to={spec.to} className="font-medium text-brand-700 hover:underline">
          Open {spec.menu} →
        </Link>
      </div>
    )
  }

  const elsewhere = (ctx.locations.get(spec.path) ?? []).filter((l) => !(l.pageId === here.pageId && l.section === here.section))
  const header = <RowHeader label={spec.label} role={spec.kind === 'text' ? spec.role : undefined} note={spec.note} changed={ctx.isChanged(spec.path)} elsewhere={elsewhere} />

  if (spec.kind === 'list') return <ListRow spec={spec} header={header} ctx={ctx} />
  return (
    <fieldset aria-label={spec.label} className="flex flex-col gap-2">
      {header}
      <LocaleInputs label={spec.label} path={spec.path} role={spec.role} ctx={ctx} />
    </fieldset>
  )
}

function RowHeader({ label, role, note, changed, elsewhere }: { label: string; role?: Role; note?: string; changed: boolean; elsewhere: Location[] }) {
  const info = role && roleInfo[role]
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-stone-800">{label}</span>
        {info && info.name.toLowerCase() !== label.toLowerCase() && (
          <span className={`rounded px-1.5 py-px text-[0.68rem] font-medium ${info.hidden ? 'bg-violet-50 text-violet-700' : 'bg-stone-100 text-stone-600'}`}>{info.name}</span>
        )}
        {changed && <span className="rounded bg-amber-100 px-1.5 py-px text-[0.68rem] font-medium text-amber-800">Edited</span>}
      </div>
      {info?.hidden && <p className="text-xs text-violet-700/80">{info.hidden}</p>}
      {note && <p className="text-xs text-stone-500">{note}</p>}
      {elsewhere.length > 0 && (
        <p className="text-xs text-stone-500">
          <span className="font-medium text-stone-600">Also on: </span>
          {elsewhere.map((l) => `${l.page} › ${l.section}`).join(', ')}. Changing it here changes it there too.
        </p>
      )}
    </div>
  )
}

function LocaleInputs({ label, path, role, ctx }: { label: string; path: string; role: Role; ctx: RowContext }) {
  const values = Object.fromEntries(locales.map((l) => [l, String(getPath(ctx.drafts[l], path) ?? '')])) as Record<Locale, string>
  const longest = Math.max(...locales.map((l) => values[l].length))
  const multiline = longest > 40 || role === 'body' || role === 'message'
  return (
    <div className={ctx.compact ? 'grid gap-3' : 'grid gap-3 md:grid-cols-2'}>
      {locales.map((l) => {
        const value = values[l]
        const props = {
          value,
          'aria-label': `${label} (${languageName[l]})`,
          className: `w-full ${value ? '' : 'border-amber-300 bg-amber-50'}`,
          onChange: (e: { target: { value: string } }) => ctx.update(l, path, e.target.value),
        }
        return (
          <label key={l} className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-xs text-stone-500">
              <span className="rounded bg-stone-100 px-1 py-px text-[0.65rem] font-semibold tracking-wide text-stone-600 uppercase">{l}</span>
              {languageName[l]}
              {!value && <span className="text-amber-700">· empty</span>}
            </span>
            {/* Grows with its text (field-sizing), so long paragraphs are readable without scrolling inside the box. */}
            {multiline ? (
              <textarea rows={Math.min(12, Math.max(2, Math.ceil(longest / 34)))} {...props} className={`${props.className} field-sizing-content min-h-16`} />
            ) : (
              <input {...props} />
            )}
          </label>
        )
      })}
    </div>
  )
}

function ListRow({ spec, header, ctx }: { spec: ListSpec; header: ReactNode; ctx: RowContext }) {
  const count = Math.max(...locales.map((l) => ((getPath(ctx.drafts[l], spec.path) as unknown[] | undefined) ?? []).length))
  return (
    <div className="flex flex-col gap-3">
      {header}
      {Array.from({ length: count }, (_, i) => (
        <fieldset key={i} aria-label={`${spec.item} ${i + 1}`} className="flex flex-col gap-3 rounded-md border border-stone-200 bg-stone-50/60 p-4">
          <p className="text-xs font-semibold text-stone-500">
            {spec.item} {i + 1}
          </p>
          {spec.fields.map((field) => {
            const path = field.key ? `${spec.path}.${i}.${field.key}` : `${spec.path}.${i}`
            return (
              <div key={path} className="flex flex-col gap-1.5">
                {spec.fields.length > 1 && <span className="text-xs font-medium text-stone-700">{field.label}</span>}
                <LocaleInputs label={`${spec.item} ${i + 1} ${field.label}`} path={path} role={field.role} ctx={ctx} />
              </div>
            )
          })}
        </fieldset>
      ))}
    </div>
  )
}

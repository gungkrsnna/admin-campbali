import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { api, ApiError } from '../lib/api'
import { env } from '../lib/env'
import { usePublishStatus } from '../lib/publish'
import { Icon } from './icons'
import { Button, ErrorBox, Loading } from './ui'

type NavItem = { to: string; label: string; icon: ReactNode; end?: boolean; badge?: 'publish' }

const navGroups: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { to: '/', label: 'Overview', icon: <Icon name="home" />, end: true },
      { to: '/publish', label: 'Publish', icon: <Icon name="publish" />, badge: 'publish' },
    ],
  },
  {
    title: 'Catalogue',
    items: [
      { to: '/products', label: 'Products', icon: <Icon name="product" /> },
      { to: '/categories', label: 'Categories', icon: <Icon name="category" /> },
    ],
  },
  {
    title: 'Content',
    items: [
      { to: '/pages', label: 'Site Editor', icon: <Icon name="page" /> },
      { to: '/testimonials', label: 'Testimonials', icon: <Icon name="quote" /> },
      { to: '/faqs', label: 'FAQs', icon: <Icon name="faq" /> },
      { to: '/milestones', label: 'Milestones', icon: <Icon name="milestone" /> },
    ],
  },
  {
    title: 'Settings',
    items: [
      {
        to: '/settings',
        label: 'Site Settings',
        icon: <Icon name="settings" />,
      },
    ],
  },
]

/** Guards every admin screen: signed in, and listed as an admin by the backend. */
export function Layout() {
  const { session, signOut } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const me = useQuery({
    queryKey: ['me', session?.user.id],
    queryFn: () => api<{ id: string; email: string }>('/me'),
    enabled: Boolean(session),
    retry: false,
  })

  // While the mobile menu is open: Escape closes it and the page behind doesn't scroll.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  if (session === undefined) return <Loading />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (me.isPending) return <Loading />
  if (me.error) {
    return (
      <div className="mx-auto mt-24 flex max-w-md flex-col gap-4 px-4">
        <ErrorBox error={me.error} />
        {me.error instanceof ApiError && me.error.status === 403 && (
          <p className="text-sm text-stone-600">
            Signed in as <b>{session.user.email}</b>. Ask the site administrator to run <code>npm run create-admin</code> for this account.
          </p>
        )}
        <Button onClick={signOut}>Sign out</Button>
      </div>
    )
  }

  const sidebar = <Sidebar email={me.data.email} onNavigate={() => setMenuOpen(false)} onSignOut={signOut} />

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop: fixed sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">{sidebar}</aside>

      {/* Mobile / tablet: top bar + slide-in drawer */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-forest px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          className="-ml-2 flex size-10 items-center justify-center rounded-md text-cream/80 hover:bg-white/5 hover:text-cream"
        >
          <Icon name="menu" />
        </button>
        <Brand compact />
        <PublishShortcut />
      </header>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden ${menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        aria-hidden={!menuOpen}
        inert={!menuOpen}
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transition-transform duration-300 ease-out lg:hidden ${menuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}
      >
        <button
          type="button"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
          className="absolute top-5 right-3 z-10 flex size-9 items-center justify-center rounded-md text-cream/60 hover:bg-white/5 hover:text-cream"
        >
          <Icon name="close" />
        </button>
        {sidebar}
      </aside>

      {/* overflow-x-clip keeps the title bar's full-width background inside this column (and, unlike hidden, keeps sticky working). */}
      <main className="min-w-0 flex-1 overflow-x-clip px-4 py-6 sm:px-8 sm:py-8">
        {/* The Site Editor shows the website next to its editing panel, so it gets the full width. */}
        <div className={location.pathname === '/pages' ? 'mx-auto max-w-[1600px]' : 'mx-auto max-w-5xl'}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function Sidebar({ email, onNavigate, onSignOut }: { email: string; onNavigate: () => void; onSignOut: () => void }) {
  const pending = usePendingCount()
  return (
    <div className="flex h-full flex-col bg-forest text-cream">
      <div className="px-5 pt-6 pb-5">
        <Brand />
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
        {navGroups.map((group, i) => (
          <div key={group.title ?? i} className="flex flex-col gap-0.5">
            {group.title && <p className="px-3 pb-1.5 text-[0.65rem] font-medium tracking-[0.2em] text-cream/40 uppercase">{group.title}</p>}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                    isActive ? 'bg-white/10 font-medium text-cream' : 'text-cream/65 hover:bg-white/5 hover:text-cream'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-gold" />}
                    <span className={isActive ? 'text-gold' : 'text-cream/50'}>{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {item.badge === 'publish' && pending > 0 && (
                      <span className="rounded-full bg-gold px-1.5 py-px text-[0.7rem] font-semibold text-forest tabular-nums" aria-label={`${pending} unpublished`}>
                        {pending}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        {env.siteUrl && (
          <a
            href={env.siteUrl}
            target="_blank"
            rel="noreferrer"
            className="mb-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-cream/65 transition hover:bg-white/5 hover:text-cream"
          >
            <span className="text-cream/50">
              <Icon name="external" />
            </span>
            View site
          </a>
        )}
        <div className="flex items-center gap-3 rounded-md bg-white/5 px-3 py-2.5">
          <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gold/20 text-sm font-medium text-gold uppercase">
            {email.charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-cream/80" title={email}>
              {email}
            </p>
            <p className="text-[0.65rem] text-cream/40">Admin</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
            title="Sign out"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-cream/50 transition hover:bg-white/10 hover:text-cream"
          >
            <Icon name="signOut" size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <NavLink to="/" className="flex items-center gap-3">
      <span className={`flex shrink-0 items-center justify-center rounded-full bg-cream ${compact ? 'size-8' : 'size-10'}`}>
        <img src="/favicon.svg" alt="" className={compact ? 'size-5' : 'size-7'} />
      </span>
      <span className="leading-tight">
        <span className={`block font-serif tracking-wide text-cream ${compact ? 'text-base' : 'text-lg'}`}>Camp Bali</span>
        {!compact && <span className="block text-[0.65rem] font-medium tracking-[0.3em] text-gold uppercase">Admin</span>}
      </span>
    </NavLink>
  )
}

/** Number of saved changes not on the website yet (the first publish counts as one). */
function usePendingCount() {
  const { data } = usePublishStatus()
  if (!data) return 0
  return data.lastPublished ? data.changes.length : 1
}

/** Phone and tablet top bar: shows the Publish button while something is waiting. */
function PublishShortcut() {
  const pending = usePendingCount()
  const location = useLocation()
  if (!pending || location.pathname === '/publish') return null
  return (
    <NavLink to="/publish" className="ml-auto flex items-center gap-1.5 rounded-md bg-gold px-3 py-1.5 text-sm font-medium text-forest">
      Publish
      <span className="rounded-full bg-forest/15 px-1.5 text-xs tabular-nums">{pending}</span>
    </NavLink>
  )
}

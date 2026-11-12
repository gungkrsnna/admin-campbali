import { useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router'
import { errorText } from '../lib/api'
import { localeLabels, locales, type Locale, type Localized } from '../lib/types'
const buttonStyles = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 shadow-xs',
  secondary: 'bg-white text-stone-700 border border-stone-300 hover:bg-stone-50 shadow-xs',
  danger: 'bg-white text-red-700 border border-red-200 hover:bg-red-50',
  ghost: 'text-stone-600 hover:bg-stone-100',
}

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonStyles }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${buttonStyles[variant]} ${className}`}
    />
  )
}

/**
 * Page title bar. It sticks to the top while scrolling, so the title and the page's actions
 * (Save, Discard, …) stay in reach on long forms. The description scrolls away underneath.
 */
export function PageHeader({
  title,
  description,
  actions,
  parent,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  /** Breadcrumb back to the list this page belongs to. */
  parent?: { to: string; label: string }
}) {
  const scrolled = useScrolled()
  const ref = useRef<HTMLDivElement>(null)

  // Publish the bar's height so other sticky elements (e.g. the Site Editor panels) can sit below it.
  useLayoutEffect(() => {
    const bar = ref.current!
    const observer = new ResizeObserver(() => document.documentElement.style.setProperty('--page-header-h', `${bar.offsetHeight}px`))
    observer.observe(bar)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div
        ref={ref}
        className={`sticky top-14 z-20 -mt-3 flex min-h-16 items-center justify-between gap-4 py-3 lg:top-0
          before:absolute before:inset-y-0 before:-inset-x-[100vmax] before:-z-10 before:bg-stone-50/95 before:backdrop-blur
          after:absolute after:bottom-0 after:-inset-x-[100vmax] after:h-px after:bg-stone-200 after:transition-opacity
          ${scrolled ? 'after:opacity-100' : 'after:opacity-0'} ${description ? 'pb-1' : 'mb-4'}`}
      >
        <div className="min-w-0">
          {parent && (
            <nav aria-label="Breadcrumb" className="mb-0.5 flex items-center gap-1.5 text-xs text-stone-500">
              <Link to={parent.to} className="hover:text-stone-800 hover:underline">
                {parent.label}
              </Link>
              <span aria-hidden>›</span>
            </nav>
          )}
          <h1 className="truncate text-xl font-semibold text-stone-900 sm:text-2xl">{title}</h1>
        </div>
        {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
      </div>
      {description && <p className="mb-6 max-w-2xl text-sm text-stone-500">{description}</p>}
    </>
  )
}

/** True once the window has scrolled — used to show the title bar's divider only when content passes under it. */
function useScrolled() {
  const [scrolled, setScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > 0)
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 0)
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])
  return scrolled
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-stone-200 bg-white p-5 shadow-xs ${className}`}>{children}</div>
}

/** A titled block of a form: heading and short explanation on top, fields below. */
export function FormSection({
  title,
  description,
  actions,
  children,
  className = '',
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-lg border border-stone-200 bg-white shadow-xs ${className}`}>
      <header className="flex items-start justify-between gap-4 border-b border-stone-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-stone-500">{description}</p>}
        </div>
        {actions}
      </header>
      <div className="flex flex-col gap-5 p-5">{children}</div>
    </section>
  )
}

/** Red outline for an input that failed validation. */
export const invalidInput = 'border-red-500 bg-red-50/60 focus:border-red-600 focus:ring-red-100'

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null
  return (
    <p id={id} className="flex items-center gap-1 text-xs text-red-600">
      {children}
    </p>
  )
}

export function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-stone-700">{label}</span>
      {children}
      {error ? <FieldError>{error}</FieldError> : hint && <span className="text-xs text-stone-500">{hint}</span>}
    </label>
  )
}

/** One label, an English and an Indonesian input side by side. */
export function LocalizedField({
  label,
  value,
  onChange,
  multiline = false,
  rows = 3,
  hint,
  errors,
  placeholder,
}: {
  label: string
  value: Localized
  onChange: (value: Localized) => void
  multiline?: boolean
  rows?: number
  hint?: ReactNode
  errors?: Partial<Record<Locale, string>>
  placeholder?: Partial<Record<Locale, string>>
}) {
  return (
    <fieldset className="flex flex-col gap-1.5 text-sm">
      <legend className="mb-1.5 font-medium text-stone-700">{label}</legend>
      <div className="grid gap-3 md:grid-cols-2">
        {locales.map((locale) => {
          const error = errors?.[locale]
          const props = {
            value: value[locale],
            placeholder: placeholder?.[locale],
            'aria-invalid': error ? true : undefined,
            className: `w-full ${error ? invalidInput : ''}`,
            onChange: (e: { target: { value: string } }) => onChange({ ...value, [locale]: e.target.value }),
          }
          return (
            <label key={locale} className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs text-stone-500">
                <span className="rounded bg-stone-100 px-1 py-px text-[0.65rem] font-semibold tracking-wide text-stone-600 uppercase">{locale}</span>
                {localeLabels[locale]}
              </span>
              {multiline ? <textarea rows={rows} {...props} /> : <input {...props} />}
              <FieldError>{error}</FieldError>
            </label>
          )
        })}
      </div>
      {hint && <p className="text-xs text-stone-500">{hint}</p>}
    </fieldset>
  )
}

/** On/off switch with an optional line of explanation. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 text-sm">
      <span>
        <span className="font-medium text-stone-800">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-stone-500">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:outline-none ${checked ? 'bg-brand-600' : 'bg-stone-300'}`}
      >
        <span className={`inline-block size-5 rounded-full bg-white shadow-sm transition ${checked ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
      </button>
    </label>
  )
}

/** Whether an item is shown on the website (once published) or hidden from it. */
export function StatusBadge({ published }: { published: boolean }) {
  return published ? (
    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">Visible</span>
  ) : (
    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">Hidden</span>
  )
}

export function Loading() {
  return <p className="py-10 text-center text-sm text-stone-500">Loading…</p>
}

export function ErrorBox({ error }: { error: unknown }) {
  return <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorText(error)}</p>
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-stone-300 py-10 text-center text-sm text-stone-500">{children}</p>
}

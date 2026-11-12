import { useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { env } from '../lib/env'
import { supabase } from '../lib/supabase'

/** Supabase Auth messages, in the admin's language. */
function loginErrorText(message: string) {
  if (message === 'Invalid login credentials') return 'Incorrect email or password.'
  if (message === 'Email not confirmed') return 'This email hasn’t been confirmed yet. Contact the site administrator.'
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Wait a moment, then try again.'
  if (/fetch|network/i.test(message)) return 'Can’t reach the server. Check your internet connection.'
  return message
}

export function Login() {
  const { session } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Keep the dark background while the stored session is checked, so the page doesn't flash white.
  if (session === undefined) return <div className="min-h-screen bg-forest" />
  if (session) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError(loginErrorText(error.message))
  }

  return (
    <div className="flex min-h-screen bg-forest font-display">
      {/* Photo panel — desktop only */}
      <aside className="relative hidden w-1/2 overflow-hidden lg:block xl:w-[55%]">
        <img src="/login.webp" alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-linear-to-t from-forest via-forest/30 to-forest/10" />
        <div className="absolute inset-x-0 bottom-0 p-12 xl:p-16">
          <p className="text-xs font-medium tracking-[0.3em] text-gold uppercase">Bali, Indonesia</p>
          <p className="mt-4 max-w-md font-serif text-4xl leading-tight text-cream xl:text-5xl">
            Rooted in Bali, <em className="text-gold">dedicated to community.</em>
          </p>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex flex-1 flex-col px-6 py-8 sm:px-12">
        <Brand />

        <div className="flex flex-1 items-center justify-center py-10">
          <form onSubmit={submit} className="w-full max-w-sm animate-fade-up">
            <h1 className="font-serif text-3xl text-cream sm:text-4xl">Welcome back</h1>
            <p className="mt-2 text-sm text-cream/60">Sign in to manage products, page copy and site details.</p>

            <div className="mt-8 flex flex-col gap-5">
              <LoginField label="Email" htmlFor="email">
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  autoFocus
                  required
                  placeholder="name@campbali.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </LoginField>

              <LoginField label="Password" htmlFor="password">
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputClass} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide characters' : 'Show characters'}
                    aria-pressed={showPassword}
                    title={showPassword ? 'Hide' : 'Show'}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-cream/50 transition hover:text-cream focus-visible:text-cream focus-visible:outline-none"
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </LoginField>
            </div>

            {error && (
              <p role="alert" className="mt-5 flex items-start gap-2 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">
                <AlertIcon />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-cream text-sm font-medium tracking-wide text-forest transition hover:bg-white focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-forest focus-visible:outline-none disabled:cursor-wait disabled:opacity-70"
            >
              {busy && <Spinner />}
              {busy ? 'Signing in…' : 'Sign in'}
            </button>

            <p className="mt-6 text-center text-xs text-cream/40">Forgot your password? Ask the site administrator to reset it.</p>
          </form>
        </div>

        {env.siteUrl && (
          <a href={env.siteUrl} className="self-start text-sm text-cream/50 transition hover:text-cream">
            ← Back to site
          </a>
        )}
      </main>
    </div>
  )
}

// Inputs here sit on the dark panel, so they override the light admin defaults from index.css.
const inputClass =
  'h-12 w-full rounded-md border-cream/15 bg-cream/5 px-4 text-base text-cream shadow-none placeholder:text-cream/30 focus:border-gold focus:bg-cream/10 focus:ring-gold/20 sm:text-sm'

function LoginField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-xs font-medium tracking-[0.15em] text-cream/70 uppercase">
        {label}
      </label>
      {children}
    </div>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-full bg-cream">
        <img src="/favicon.svg" alt="" className="size-7" />
      </span>
      <div className="leading-tight">
        <p className="font-serif text-lg tracking-wide text-cream">Camp Bali</p>
        <p className="text-[0.65rem] font-medium tracking-[0.3em] text-gold uppercase">Admin</p>
      </div>
    </div>
  )
}

function Spinner() {
  return <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-forest/30 border-t-forest" />
}

const iconProps = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

function EyeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg {...iconProps}>
      <path d="M10.6 5.1A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.6 3.5M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a10.4 10.4 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m2 2 20 20" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg {...iconProps} width={16} height={16} className="mt-0.5 shrink-0">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  )
}

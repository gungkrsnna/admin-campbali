import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import { Button, ErrorBox, Field, FormSection, invalidInput, Loading, PageHeader } from '../components/ui'
import { api } from '../lib/api'
import type { SiteSettings } from '../lib/types'
import { useUnsavedChanges } from '../lib/useUnsavedChanges'
import { SAVED_AS_DRAFT } from '../lib/publish'

type Draft = Omit<SiteSettings, 'updated_at'>
type Errors = Partial<Record<keyof Draft, string>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The fields this form edits (the API also returns updated_at). */
const editable = (s: SiteSettings): Draft => ({ name: s.name, whatsapp_number: s.whatsapp_number, email: s.email, location: s.location, instagram_url: s.instagram_url })

/** What gets saved: trimmed, WhatsApp reduced to digits. */
function clean(draft: Draft): Draft {
  return {
    name: draft.name.trim(),
    whatsapp_number: draft.whatsapp_number.replace(/\D/g, ''),
    email: draft.email.trim(),
    location: draft.location.trim(),
    instagram_url: draft.instagram_url.trim(),
  }
}

function validate(draft: Draft): Errors {
  const d = clean(draft)
  const errors: Errors = {}
  if (!d.name) errors.name = 'Enter the site name.'
  if (d.whatsapp_number && (d.whatsapp_number.length < 8 || d.whatsapp_number.length > 15))
    errors.whatsapp_number = 'That doesn’t look like a full number. Use the country code, e.g. 6281234567890.'
  else if (d.whatsapp_number.startsWith('0')) errors.whatsapp_number = 'Start with the country code (62 for Indonesia) instead of 0.'
  if (d.email && !EMAIL.test(d.email)) errors.email = 'Enter a valid email address, e.g. hello@campbali.com.'
  if (d.instagram_url && !/^https?:\/\/\S+\.\S+/.test(d.instagram_url)) errors.instagram_url = 'Enter the full address, starting with https://'
  return errors
}

export function Settings() {
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api<SiteSettings>('/settings') })
  if (settings.error) return <ErrorBox error={settings.error} />
  if (!settings.data) return <Loading />
  return <SettingsForm initial={editable(settings.data)} />
}

function SettingsForm({ initial }: { initial: Draft }) {
  const [baseline, setBaseline] = useState(initial)
  const [draft, setDraft] = useState(initial)
  const [submitted, setSubmitted] = useState(false)
  const queryClient = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()

  const dirty = JSON.stringify(clean(draft)) !== JSON.stringify(clean(baseline))
  useUnsavedChanges(dirty)
  const errors = submitted ? validate(draft) : {}
  const set = (key: keyof Draft) => (e: { target: { value: string } }) => setDraft({ ...draft, [key]: e.target.value })

  const save = useMutation({
    mutationFn: () => api<SiteSettings>('/settings', { method: 'PUT', body: clean(draft) }),
    onSuccess: (result) => {
      const saved = editable(result)
      setBaseline(saved)
      setDraft(saved)
      setSubmitted(false)
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success(SAVED_AS_DRAFT)
    },
    onError: toast.error,
  })

  function submit() {
    setSubmitted(true)
    if (Object.keys(validate(draft)).length) {
      toast.error('Some fields need attention.')
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    save.mutate()
  }

  async function discard() {
    if (await confirm({ title: 'Discard changes?', message: 'Everything you changed since the last save will be lost.', confirmLabel: 'Discard', tone: 'danger' })) {
      setDraft(baseline)
      setSubmitted(false)
    }
  }

  const input = (key: keyof Draft, props: Record<string, unknown> = {}) => (
    <input aria-invalid={errors[key] ? true : undefined} className={errors[key] ? invalidInput : ''} value={draft[key]} onChange={set(key)} {...props} />
  )
  const preview = clean(draft)

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <PageHeader
        title="Site Settings"
        description="Contact details shown on the Contact page, in the footer and on the WhatsApp button."
        actions={
          <>
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
            <Button type="submit" variant="primary" disabled={save.isPending || !dirty}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      />

      <div className="flex max-w-3xl flex-col gap-5">
        <FormSection title="General">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Site name" error={errors.name}>
              {input('name', { placeholder: 'Camp Bali' })}
            </Field>
            <Field label="Location" hint="Shown on the Contact page and in the footer.">
              {input('location', { placeholder: 'e.g. Bali, Indonesia' })}
            </Field>
          </div>
        </FormSection>

        <FormSection title="Contact" description="Leave a field empty to hide it on the site.">
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="WhatsApp number"
              error={errors.whatsapp_number}
              hint={preview.whatsapp_number ? <LinkPreview href={`https://wa.me/${preview.whatsapp_number}`}>wa.me/{preview.whatsapp_number}</LinkPreview> : 'With country code, e.g. 62 812 3456 7890. Spaces and + are fine.'}
            >
              {input('whatsapp_number', { inputMode: 'tel', placeholder: '62 812 3456 7890' })}
            </Field>
            <Field label="Email" error={errors.email} hint="Where customers can write to you.">
              {input('email', { type: 'email', placeholder: 'hello@campbali.com' })}
            </Field>
          </div>
        </FormSection>

        <FormSection title="Social media">
          <Field
            label="Instagram"
            error={errors.instagram_url}
            hint={preview.instagram_url && !errors.instagram_url ? <LinkPreview href={preview.instagram_url}>Open the profile</LinkPreview> : 'The full profile address, e.g. https://instagram.com/campbali'}
          >
            {input('instagram_url', { type: 'url', placeholder: 'https://instagram.com/campbali' })}
          </Field>
        </FormSection>
      </div>
    </form>
  )
}

/** A small "test this link" under a field, so the admin can check the number or URL works. */
function LinkPreview({ href, children }: { href: string; children: ReactNode }) {
  return (
    <span>
      Test:{' '}
      <a href={href} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
        {children} ↗
      </a>
    </span>
  )
}

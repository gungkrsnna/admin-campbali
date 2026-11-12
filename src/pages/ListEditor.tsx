import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useConfirm } from '../components/ConfirmDialog'
import { Icon } from '../components/icons'
import { SortableList } from '../components/Sortable'
import { useToast } from '../components/Toast'
import { Button, EmptyState, ErrorBox, Field, invalidInput, Loading, LocalizedField, PageHeader, StatusBadge, Toggle } from '../components/ui'
import { api } from '../lib/api'
import { nextSortOrder, useReorder } from '../lib/reorder'
import { emptyLocalized, locales, type Locale, type Localized } from '../lib/types'
import { useUnsavedChanges } from '../lib/useUnsavedChanges'
import { DELETED_AS_DRAFT, SAVED_AS_DRAFT } from '../lib/publish'

type FieldDef = {
  key: string
  label: string
  kind: 'text' | 'localized' | 'localized-long'
  /** Required unless set to false. Localized fields then need both languages. */
  required?: boolean
  hint?: string
  placeholder?: string | Partial<Record<Locale, string>>
}

export type ListConfig = {
  resource: 'testimonials' | 'faqs' | 'milestones'
  title: string
  description: string
  /** Singular name, e.g. "question": used in "Add question", "Edit question". */
  noun: string
  fields: FieldDef[]
  /** How a row reads in the list: main line, optional second line and a small leading tag. */
  summary: (item: Item) => { title: string; subtitle?: string; tag?: string }
  defaultPublished: boolean
  publishedHint: { on: string; off: string }
}

type Item = Record<string, unknown> & { id?: string; sort_order: number; is_published: boolean }
type Editing = { baseline: Item; draft: Item }
type Errors = Record<string, string>

const languageName: Record<Locale, string> = { en: 'English', id: 'Indonesian' }

function blankItem(config: ListConfig, sortOrder: number): Item {
  const item: Item = { sort_order: sortOrder, is_published: config.defaultPublished }
  for (const field of config.fields) item[field.key] = field.kind === 'text' ? '' : emptyLocalized()
  return item
}

/** Only the editable columns. The backend ignores the rest, but this keeps requests tidy. */
function payload(config: ListConfig, item: Item) {
  const body: Record<string, unknown> = { sort_order: item.sort_order, is_published: item.is_published }
  for (const field of config.fields) body[field.key] = item[field.key]
  return body
}

function validate(config: ListConfig, item: Item): Errors {
  const errors: Errors = {}
  for (const field of config.fields) {
    if (field.required === false) continue
    const label = field.label.toLowerCase()
    if (field.kind === 'text') {
      if (!String(item[field.key] ?? '').trim()) errors[field.key] = `Enter the ${label}.`
    } else {
      const value = item[field.key] as Localized
      for (const locale of locales) if (!value[locale].trim()) errors[`${field.key}.${locale}`] = `Enter the ${label} in ${languageName[locale]}.`
    }
  }
  return errors
}

export function ListEditor({ config }: { config: ListConfig }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const list = useQuery({ queryKey: [config.resource], queryFn: () => api<Item[]>(`/${config.resource}`) })
  const [editing, setEditing] = useState<Editing | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const reorder = useReorder<Item>(config.resource, (item) => item.id!)

  const dirty = editing !== null && JSON.stringify(editing.draft) !== JSON.stringify(editing.baseline)
  useUnsavedChanges(dirty)

  const open = (item: Item) => {
    setSubmitted(false)
    setEditing({ baseline: item, draft: structuredClone(item) })
  }
  const close = () => {
    setEditing(null)
    setSubmitted(false)
  }

  const save = useMutation({
    mutationFn: (item: Item) =>
      item.id
        ? api(`/${config.resource}/${item.id}`, { method: 'PATCH', body: payload(config, item) })
        : api(`/${config.resource}`, { method: 'POST', body: payload(config, item) }),
    onSuccess: () => {
      toast.success(SAVED_AS_DRAFT)
      close()
      queryClient.invalidateQueries({ queryKey: [config.resource] })
    },
    onError: toast.error,
  })

  const remove = useMutation({
    mutationFn: (item: Item) => api(`/${config.resource}/${item.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(DELETED_AS_DRAFT)
      close()
      queryClient.invalidateQueries({ queryKey: [config.resource] })
    },
    onError: toast.error,
  })

  function submit() {
    if (!editing) return
    setSubmitted(true)
    if (Object.keys(validate(config, editing.draft)).length) {
      toast.error('Some fields need attention.')
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    save.mutate(editing.draft)
  }

  async function cancel() {
    if (dirty && !(await confirm({ title: 'Discard changes?', message: 'What you changed in this form will be lost.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', tone: 'danger' }))) return
    close()
  }

  async function deleteItem(item: Item) {
    const name = config.summary(item).title
    if (await confirm({ title: `Delete this ${config.noun}?`, message: `“${name}” will be removed from the site. This can’t be undone.`, confirmLabel: 'Delete', tone: 'danger' }))
      remove.mutate(item)
  }

  const items = list.data ?? []
  const formProps = editing && {
    config,
    item: editing.draft,
    errors: submitted ? validate(config, editing.draft) : {},
    dirty,
    onChange: (draft: Item) => setEditing({ ...editing, draft }),
    onSave: submit,
    onCancel: cancel,
    busy: save.isPending || remove.isPending,
  }

  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        actions={
          <Button variant="primary" disabled={editing !== null} onClick={() => open(blankItem(config, nextSortOrder(items)))}>
            <Icon name="plus" size={16} />
            Add {config.noun}
          </Button>
        }
      />

      {list.isPending && <Loading />}
      {list.error && <ErrorBox error={list.error} />}

      {formProps && !editing.baseline.id && (
        <div className="mb-4">
          <ItemForm {...formProps} />
        </div>
      )}

      {list.data && items.length === 0 && !editing && <EmptyState>Nothing here yet. Use Add {config.noun} to create the first one.</EmptyState>}

      {items.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-xs">
          <SortableList
            as="ul"
            className="divide-y divide-stone-100"
            items={items}
            getId={(item) => item.id!}
            getLabel={(item) => config.summary(item).title}
            disabled={editing !== null || reorder.isPending}
            onReorder={(next) => reorder.mutate(next)}
          >
            {(item, { handle }) => {
              if (formProps && editing.baseline.id === item.id) {
                return (
                  <div className="bg-stone-50 p-3 sm:p-4">
                    <ItemForm {...formProps} onDelete={() => deleteItem(item)} />
                  </div>
                )
              }
              const { title, subtitle, tag } = config.summary(item)
              return (
                <div className="flex items-center gap-3 px-3 py-3 sm:px-4">
                  {handle ?? <span className="w-6 shrink-0" />}
                  {/* Fixed width so the titles line up whatever the tag says ("2005", "Today & Beyond"). */}
                  {tag && (
                    <span title={tag} className="w-20 shrink-0 truncate rounded bg-stone-100 px-2 py-1 text-center text-xs font-semibold text-stone-700 tabular-nums sm:w-28">
                      {tag}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-900">{title}</p>
                    {subtitle && <p className="truncate text-xs text-stone-500">{subtitle}</p>}
                  </div>
                  <StatusBadge published={item.is_published} />
                  <Button disabled={editing !== null} onClick={() => open(item)} className="py-1.5">
                    Edit
                  </Button>
                </div>
              )
            }}
          </SortableList>
          <p className="border-t border-stone-100 bg-stone-50/60 px-4 py-2.5 text-xs text-stone-500">
            {items.length} {items.length === 1 ? config.noun : `${config.noun}s`}. Drag the handle on the left of a row to change the order on the site.
          </p>
        </div>
      )}
    </>
  )
}

function ItemForm({
  config,
  item,
  errors,
  dirty,
  onChange,
  onSave,
  onCancel,
  onDelete,
  busy,
}: {
  config: ListConfig
  item: Item
  errors: Errors
  dirty: boolean
  onChange: (item: Item) => void
  onSave: () => void
  onCancel: () => void
  onDelete?: () => void
  busy: boolean
}) {
  const isNew = !item.id
  return (
    <form
      noValidate
      className="rounded-lg border border-brand-600/30 bg-white shadow-sm ring-4 ring-brand-50"
      onSubmit={(e) => {
        e.preventDefault()
        onSave()
      }}
    >
      <header className="flex items-center justify-between gap-4 border-b border-stone-100 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-stone-900">{isNew ? `New ${config.noun}` : `Edit ${config.noun}`}</h2>
        {dirty && (
          <span className="flex items-center gap-1.5 text-xs text-amber-700">
            <span className="size-1.5 rounded-full bg-amber-500" />
            Unsaved changes
          </span>
        )}
      </header>

      <div className="flex flex-col gap-5 p-5">
        {config.fields.map((field) => {
          if (field.kind === 'text') {
            const error = errors[field.key]
            return (
              <Field key={field.key} label={field.label} hint={field.hint} error={error}>
                <input
                  aria-invalid={error ? true : undefined}
                  className={error ? invalidInput : ''}
                  placeholder={typeof field.placeholder === 'string' ? field.placeholder : undefined}
                  value={item[field.key] as string}
                  onChange={(e) => onChange({ ...item, [field.key]: e.target.value })}
                />
              </Field>
            )
          }
          return (
            <LocalizedField
              key={field.key}
              label={field.required === false ? `${field.label} (optional)` : field.label}
              hint={field.hint}
              multiline={field.kind === 'localized-long'}
              placeholder={typeof field.placeholder === 'object' ? field.placeholder : undefined}
              errors={{ en: errors[`${field.key}.en`], id: errors[`${field.key}.id`] }}
              value={item[field.key] as Localized}
              onChange={(value) => onChange({ ...item, [field.key]: value })}
            />
          )
        })}
        <div className="rounded-md border border-stone-200 bg-stone-50/60 p-4">
          <Toggle
            label="Show on website"
            description={item.is_published ? config.publishedHint.on : config.publishedHint.off}
            checked={item.is_published}
            onChange={(is_published) => onChange({ ...item, is_published })}
          />
        </div>
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-stone-100 px-5 py-3.5">
        <Button type="submit" variant="primary" disabled={busy || (!isNew && !dirty)}>
          {busy ? 'Saving…' : isNew ? `Add ${config.noun}` : 'Save'}
        </Button>
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        {onDelete && (
          <Button variant="danger" className="ml-auto" onClick={onDelete} disabled={busy}>
            Delete
          </Button>
        )}
      </footer>
    </form>
  )
}

const en = (value: unknown) => (value as Localized | undefined)?.en || (value as Localized | undefined)?.id || '(empty)'
const id = (value: unknown) => (value as Localized | undefined)?.id || undefined

export const testimonialsConfig: ListConfig = {
  resource: 'testimonials',
  title: 'Testimonials',
  description: 'Customer quotes on the home page. Only publish real testimonials you have permission to use.',
  noun: 'testimonial',
  fields: [
    { key: 'quote', label: 'Quote', kind: 'localized-long', placeholder: { en: 'What the customer said', id: 'Kutipan dalam bahasa Indonesia' } },
    { key: 'name', label: 'Name', kind: 'text', placeholder: 'e.g. Made, owner of a café in Ubud', hint: 'Who said it, as it should appear on the site.' },
    { key: 'role', label: 'Details', kind: 'localized', required: false, hint: 'Location or type of business.', placeholder: { en: 'e.g. Café, Ubud', id: 'mis. Kafe, Ubud' } },
  ],
  summary: (item) => ({ title: item.name as string, subtitle: `“${en(item.quote)}”` }),
  defaultPublished: false,
  publishedHint: { on: 'Shown on the home page.', off: 'Hidden from the site.' },
}

export const faqsConfig: ListConfig = {
  resource: 'faqs',
  title: 'FAQs',
  description: 'Frequently asked questions.',
  noun: 'question',
  fields: [
    { key: 'question', label: 'Question', kind: 'localized' },
    { key: 'answer', label: 'Answer', kind: 'localized-long' },
  ],
  summary: (item) => ({ title: en(item.question), subtitle: id(item.question) }),
  defaultPublished: true,
  publishedHint: { on: 'Shown in the FAQ on the site.', off: 'Hidden from the site.' },
}

export const milestonesConfig: ListConfig = {
  resource: 'milestones',
  title: 'Milestones',
  description: 'The timeline on the Our Story page, in top-to-bottom order.',
  noun: 'milestone',
  fields: [
    { key: 'year', label: 'Year', kind: 'text', placeholder: 'e.g. 2005 or Today', hint: 'Any short label: a year, a decade or a word.' },
    { key: 'title', label: 'Title', kind: 'localized' },
    { key: 'text', label: 'Story', kind: 'localized-long' },
  ],
  summary: (item) => ({ title: en(item.title), subtitle: id(item.title), tag: item.year as string }),
  defaultPublished: true,
  publishedHint: { on: 'Shown on the Our Story page.', off: 'Hidden from the site.' },
}
